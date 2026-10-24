"""명령줄: run / pick."""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from .config import KST, parse_now, to_kst
from .link_check import httpx_fetch, memoize_fetch
from .ingest import ingest_file
from .memes import load_memes, run_memes
from .pairing import best_frame_for_meme, build_combos, load_history, record_decision
from .pipeline import (make_sim_fetch, render_markdown, render_memes_markdown, render_today,
                       run_pipeline)
from .sources.file_source import FileSource


def _read_picks(out: Path) -> set[str]:
    p = out / "picks.jsonl"
    if not p.exists():
        return set()
    return {json.loads(l)["name"] for l in p.read_text(encoding="utf-8").splitlines() if l.strip()}


OUTPUT_FILES = ("candidates.json", "rejected.json", "memes.json", "rejected_memes.json",
                "CANDIDATES.md", "MEMES.md", "TODAY.md", "combos.json")
TOP_N = 5


def _clashing_inputs(out: Path, inputs: list[Path]) -> list[Path]:
    """출력 파일과 같은 파일인 입력(덮어쓰면 입력이 사라진다)."""
    clash = []
    for p in inputs:
        for name in OUTPUT_FILES:
            target = out / name
            if p.exists() and target.exists() and os.path.samefile(p, target):
                clash.append(p)
                break
    return clash


def cmd_run(a: argparse.Namespace) -> int:
    out = Path(a.out)
    memes_path = Path(a.memes) if a.memes else Path(a.signals).with_name("memes.json")
    clash = _clashing_inputs(out, [Path(a.signals), memes_path])
    if clash:
        print("입력 파일이 출력 파일과 같아 덮어쓰게 됩니다. --out을 다른 폴더로 지정하세요: "
              + ", ".join(str(p) for p in clash), file=sys.stderr)
        return 2
    out.mkdir(parents=True, exist_ok=True)
    signals = FileSource(a.signals).collect()
    memes = load_memes(memes_path) if memes_path.exists() else []
    fetch = httpx_fetch if a.online else make_sim_fetch(signals, memes)
    fetch = memoize_fetch(fetch)  # 같은 링크는 한 번만 연다
    now = parse_now(a.now)
    today = to_kst(now)  # 판 id·seed·최근 사용 감점의 날짜는 한국 시간 기준
    # 파이프라인은 한 번만 돌리고 전체 순위에서 상위 5개를 자른다(틀 선택은 상위 5개 밖 후보까지 쓴다)
    all_cands, rejected = run_pipeline(signals, fetch, now=now, top_n=10**6, picked=_read_picks(out))
    cands = all_cands[:TOP_N]
    rejected += [{"name": c.name, "link_status": c.link_status, "reasons": [f"상위 {TOP_N}개 밖 (점수 {c.score})"]}
                 for c in all_cands[TOP_N:]]
    all_memes, rej_memes = run_memes(memes, fetch, top_n=10**6, now=now)
    ranked = all_memes[:TOP_N]
    rej_memes += [{"name": m["name"], "kind": "meme", "reasons": [f"상위 {TOP_N}개 밖 (점수 {m['score']})"]}
                  for m in all_memes[TOP_N:]]
    combos = build_combos(all_cands, all_memes, load_history(out / "history.jsonl"), today.date())
    dump = lambda name, obj: (out / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    dump("candidates.json", [c.to_dict() for c in cands])
    dump("rejected.json", rejected)
    dump("memes.json", ranked)
    dump("rejected_memes.json", rej_memes)
    (out / "CANDIDATES.md").write_text(render_markdown(cands), encoding="utf-8")
    (out / "MEMES.md").write_text(render_memes_markdown(ranked), encoding="utf-8")
    (out / "TODAY.md").write_text(render_today(cands, ranked, today, combos), encoding="utf-8")
    dump("combos.json", combos)
    print(f"신호 {len(signals)}건 → 게임 틀 후보 {len(cands)}개, 탈락/밀림 {len(rejected)}건 / "
          f"밈 {len(memes)}건 → 후보 {len(ranked)}개, 탈락/밀림 {len(rej_memes)}건 "
          f"(링크 확인: {'온라인' if a.online else '오프라인 시연'}, 정보 표시용)")
    print("게임 틀 순위")
    for c in cands:
        print(f"  {c.rank}. {c.name} {c.score}점 → 틀 {c.frame or '-'} (인기도 {c.popularity_total:g}/100, "
              f"{c.consensus.get('label')}, 신뢰 {c.confidence})")
    print("밈 순위")
    for m in ranked:
        tgt = f"목표 {m['target_seconds']:.2f}초" if m["target_seconds"] is not None else \
            f"틀 파라미터 {m['frame_params_hint']}"
        print(f"  {m['rank']}. {m['name']} [{m['type']}] {m['score']}점 {tgt} → 잘 맞는 틀 "
              f"{best_frame_for_meme(m['type'])} ({m['consensus']['label']})")
    print("오늘의 조합 TOP 3")
    for i, c in enumerate(combos, 1):
        print(f"  {i}. {c['frame']} × {c['meme']} {c['score']}점 (적합도 {c['parts']['fit']:g}, "
              f"최근 사용 x{c['parts']['recency']:g}, 신뢰 {c['confidence']})")
    for r in rejected + rej_memes:
        print(f"  x {r['name']}: {'; '.join(r['reasons'])}")
    return 0


def cmd_decide(a: argparse.Namespace) -> int:
    try:
        record_decision(Path(a.out) / "history.jsonl", a.date, a.frame)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 1
    print(f"기록: {a.date} → {a.frame} ({Path(a.out) / 'history.jsonl'})")
    return 0


def cmd_ingest(a: argparse.Namespace) -> int:
    r = ingest_file(a.text, a.kind, a.out)
    print(f"ingest {a.kind}: {r['items']}항목 파싱, 정상 {r['ok']}, needs_review {r['needs_review']} → {a.out}")
    for n in r["review_names"]:
        print(f"  needs_review: {n}")
    return 0


def cmd_pick(a: argparse.Namespace) -> int:
    out = Path(a.out)
    cj = out / "candidates.json"
    if cj.exists():
        names = [c["name"] for c in json.loads(cj.read_text(encoding="utf-8"))]
        if a.name not in names:
            print(f"후보에 없는 이름: {a.name} (후보: {', '.join(names)})", file=sys.stderr)
            return 1
    out.mkdir(parents=True, exist_ok=True)
    rec = {"name": a.name, "picked_at": datetime.now(KST).isoformat()}
    with (out / "picks.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"선택 기록: {a.name}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="discovery")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--signals", required=True)
    r.add_argument("--out", default="out")
    r.add_argument("--online", action="store_true", help="실제 HTTP로 링크 검증(기본은 오프라인 시연)")
    r.add_argument("--now", help="기준 시각 ISO(시험·재현용)")
    r.add_argument("--memes", help="밈 신호 JSON(기본: signals 파일 옆의 memes.json, 없으면 밈 없이 실행)")
    r.set_defaults(fn=cmd_run)
    g = sub.add_parser("ingest", help="슈퍼구루 조사 본문(txt) → 신호 JSON")
    g.add_argument("--text", required=True)
    g.add_argument("--kind", required=True, choices=["game", "meme"])
    g.add_argument("--out", required=True)
    g.set_defaults(fn=cmd_ingest)
    d = sub.add_parser("decide", help="오늘 판의 틀을 history에 기록(같은 틀 연속 방지)")
    d.add_argument("--date", required=True, help="YYYY-MM-DD")
    d.add_argument("--frame", required=True)
    d.add_argument("--out", default="out")
    d.set_defaults(fn=cmd_decide)
    k = sub.add_parser("pick")
    k.add_argument("--name", required=True)
    k.add_argument("--out", default="out")
    k.set_defaults(fn=cmd_pick)
    a = p.parse_args(argv)
    return a.fn(a)
