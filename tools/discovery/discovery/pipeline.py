"""신호 목록 → 점수(인기도 중심) → 걸러내기 → 상위 N 후보 카드. 링크 검사는 정보 표시용."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Iterable

from . import rules
from .config import MAX_SESSION_S, MIN_SESSION_S, ROUND_SLACK_S
from .link_check import Fetch, check_link
from .models import Candidate, Signal
from .popularity import background_line, compute_popularity, verify_links
from .scoring import load_weights, score_signal

SAMPLE_MARK = "샘플 자료(가상 입력, 실제 조사 결과가 아님)"


def make_sim_fetch(signals: Iterable[Any], memes: Iterable[Any] = ()) -> Fetch:
    """오프라인 시연: 각 신호의 sim({status, body} 또는 {timeout:true})을 응답으로 돌려준다."""
    table: dict[str, dict] = {}
    for s in list(signals) + list(memes):
        if getattr(s, "url", "") and getattr(s, "sim", None) is not None:
            table[s.url] = s.sim or {}
        for e in list(s.online) + list(s.community):
            u = e.get("source_url") or e.get("url")
            if u:
                table[u] = e.get("sim") or {}

    def fetch(url: str, timeout: float) -> tuple[int, str]:
        sim = table.get(url, {})
        if sim.get("timeout") or not sim:
            raise TimeoutError(url)
        return int(sim.get("status", 200)), sim.get("body", "")

    return fetch


def _public(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{k: v for k, v in e.items() if k not in ("sim", "url", "link_status")} for e in items]


def run_pipeline(signals: list[Signal], fetch: Fetch, weights: dict[str, Any] | None = None,
                 ip_terms: dict | None = None, now: datetime | None = None,
                 top_n: int = 5, picked: set[str] | None = None
                 ) -> tuple[list[Candidate], list[dict[str, Any]]]:
    w = weights or load_weights()
    ip_terms = ip_terms if ip_terms is not None else rules.load_ip_terms()
    now = now or datetime.now(timezone.utc)
    picked = picked or set()

    kept = []
    rejected: list[dict[str, Any]] = []
    for s in signals:
        status = check_link(s.url, s.name, fetch) if s.url else "미확인"  # 정보 표시용
        if s.needs_review:
            rejected.append({"name": s.name, "link_status": status,
                             "reasons": ["사람 검토 필요(needs_review): " + "; ".join(s.review_reasons or ["사유 미기재"])]})
            continue
        if s.inferred and not s.frame_guess:  # 규칙·조작으로 틀 6종 어디에도 연결 안 됨
            rejected.append({"name": s.name, "link_status": status,
                             "reasons": ["구현할 틀 없음: 틀 6종(timing_stop, tap_rush, swipe_dodge, gauge_stop, "
                                         "outline_trace, merge_drop) 중 가까운 것이 없음"]})
            continue
        has_pop = bool(s.online or s.community)  # 없으면 옛 신호 강도 계산(하위 호환)
        pop = compute_popularity(s.online, s.community, s.fading, s.astroturf_suspect, w)
        res = score_signal(s, w, ip_terms, now, pop if has_pop else None)
        reasons = list(res.fail_reasons)
        if res.ip_penalty >= w["ip_drop_at"]:
            reasons.append(f"저작권 위험: 상표·캐릭터·음원이 규칙의 일부(감점 {res.ip_penalty:g})")
        if reasons:
            rejected.append({"name": s.name, "link_status": status, "reasons": reasons})
        else:
            kept.append((res.total, s, status, pop))

    kept.sort(key=lambda x: (-x[0], x[1].name))
    cands = []
    for i, (score, s, status, pop) in enumerate(kept[:top_n], 1):
        ex = rules.extract(s, ip_terms)
        links = verify_links(s.online, s.community, s.name, fetch)
        cands.append(Candidate(
            rank=i, name=s.name, score=score,
            rule_one_line=ex["rule_one_line"],
            session_length=s.traits.get("session_seconds"),
            controls=list(s.traits.get("controls") or []),
            score_type=s.traits.get("score_type", ""),
            new_skin=ex["new_skin"], ip_risks=ex["ip_risks"],
            link_status=status, evidence_url=s.url,
            picked=s.name in picked,
            online=_public(s.online), community=_public(s.community),
            fading=s.fading, astroturf_suspect=s.astroturf_suspect,
            popularity_total=pop.total, popularity_scores=pop.scores, popularity_notes=pop.notes,
            consensus=pop.consensus,
            link_info={"game": status, "game_url": s.url, "evidence": links,
                       "note": "링크 열림은 정보 표시용. 점수·탈락에 쓰지 않음"},
            meme_context=dict(s.meme_context),
            background_line=background_line(s.meme_context, pop.scores, pop.consensus),
            sample=s.sample, frame=s.frame_guess, frame_reason=s.frame_reason, inferred=s.inferred,
            confidence="낮음(추론값)" if s.inferred else "보통"))
    for score, s, status, _ in kept[top_n:]:  # top_n 밖으로 밀린 후보도 기록
        rejected.append({"name": s.name, "link_status": status,
                         "reasons": [f"상위 {top_n}개 밖 (점수 {score})"]})
    return cands, rejected


# ---------------- 마크다운 ----------------

def _bar(score: float, top: float = 10.0) -> str:
    n = max(0, min(10, round(score / top * 10)))
    return "█" * n + "░" * (10 - n)


def _cell(v: Any) -> str:
    return "미기재" if v in (None, "") else str(v).replace("|", "\\|")


def _approx(v: float | None) -> str:
    if not v:
        return "미기재"
    for unit, d in (("억", 1e8), ("만", 1e4)):
        if v >= d:
            return f"약 {v / d:g}{unit}"
    return f"약 {v:g}"


def render_popularity(item: dict[str, Any]) -> list[str]:
    """게임 카드·밈 카드 공통: 온라인 표, 커뮤니티 표, 합의도, 식는 신호, 점수 막대."""
    sc, cons = item["popularity_scores"], item["consensus"]
    lines = [f"### 온라인 인기도 ({sc['online']:g}/10)",
             "| 플랫폼 | 지표 | 대략 값 | 영향 규모(1~5) | 시작 | 측정 | 출처 |",
             "|---|---|---|---|---|---|---|"]
    for e in item["online"]:
        src = _cell(e.get("source_name"))
        if e.get("source_url"):
            src = f"[{src}]({e['source_url']})" if e.get("source_name") else e["source_url"]
        lines.append(f"| {_cell(e['platform'])} | {_cell(e['metric'])} | {_approx(e['value_approx'])} | "
                     f"{e['tier']} | {_cell(e['since'])} | {_cell(e['measured_at'])} | {src} |")
    if not item["online"]:
        lines.append("| (온라인 근거 없음) | | | | | | |")
    lines += ["", f"### 커뮤니티 인기도 ({sc['community']:g}/10)",
              "| 커뮤니티 | 언급 | 업보트 | 분위기 | 독립 여부 | 반대 의견 |", "|---|---|---|---|---|---|"]
    mood = {"positive": "긍정", "mixed": "엇갈림", "negative": "부정"}
    for e in item["community"]:
        lines.append(f"| {_cell(e['community'])} | {_approx(e['mentions'])} | {_approx(e['upvotes_approx'])} | "
                     f"{mood.get(e['sentiment'], e['sentiment'])} | {'독립' if e['independent'] else '재인용'} | "
                     f"{_cell(e.get('counter_view'))} |")
    if not item["community"]:
        lines.append("| (커뮤니티 근거 없음) | | | | | |")
    warn = " ⚠ 단일 출처" if cons.get("single_source") else ""
    lines += ["", "### 합의도",
              f"- 독립 출처 {cons['independent_sources']}개 ({', '.join(cons['sources']) or '없음'}) → "
              f"**{cons['label']}**{warn}, 총점 x{cons['factor']:g}", "",
              "### 식는 신호",
              "- 시들해지는 신호: " + (f"**있음** (총점 −{sc['fading_penalty']:g})" if item["fading"] else "없음"),
              "- 인위적 바이럴 의심: " + (f"**있음** (총점 −{sc['astroturf_penalty']:g})" if item["astroturf_suspect"] else "없음"),
              "", "### 인기도 점수",
              f"- 온라인: {_bar(sc['online'])} {sc['online']:g}/10",
              f"- 커뮤니티: {_bar(sc['community'])} {sc['community']:g}/10",
              f"- 합의도 계수: x{cons['factor']:g}",
              f"- **인기도 총점: {_bar(sc['total'], 100)} {sc['total']:g}/100**"]
    for k, why in item.get("popularity_notes", {}).items():
        lines.append(f"  - ({k}) {why}")
    return lines


def render_markdown(cands: list[Candidate]) -> str:
    lines = ["# 오늘의 게임 후보", ""]
    if any(c.sample for c in cands):
        lines += [f"> ⚠ {SAMPLE_MARK}", ""]
    for c in cands:
        mark = " ✅선택됨" if c.picked else ""
        lines += [
            f"## {c.rank}. {c.name} — {c.score}점{mark}" + ("  [샘플 자료]" if c.sample else ""),
            f"- 규칙: {c.rule_one_line}",
            f"- 연결된 틀: {c.frame or '없음'}" + (f" ({c.frame_reason})" if c.frame_reason else ""),
            f"- 한 판 {f'{c.session_length}초' if c.session_length else '미기재(틀 기본값)'} / "
            f"조작 {', '.join(c.controls) or '미기재'} / 점수 {c.score_type or '미기재(틀이 정함)'}"
            + (f"  ⚠ 추론값 (신뢰 {c.confidence}): 사람이 확인 전까지 참고용" if c.inferred else ""),
            f"- 새 겉모습: {c.new_skin}",
            f"- 위험 요소: {'; '.join(c.ip_risks)}",
            f"- 링크 열림(정보 표시용, 점수·탈락에 쓰지 않음): {c.link_status} ({c.evidence_url})",
            "",
        ]
        lines += render_popularity(c.to_dict())
        m = c.meme_context
        lines += ["", "### 유행 밈"]
        if m.get("summary"):
            since = f" ({m['since']}부터)" if m.get("since") else ""
            url = f" [근거]({m['url']})" if m.get("url") else ""
            lines.append(f"{m['summary']}{since}{url}")
        else:
            lines.append("유행 밈 정보 없음")
        lines += ["", f"### 배경\n{c.background_line}", ""]
    return "\n".join(lines)


def render_memes_markdown(memes: list[dict[str, Any]]) -> str:
    lines = ["# 오늘의 밈 후보", ""]
    if any(m["sample"] for m in memes):
        lines += [f"> ⚠ {SAMPLE_MARK}", ""]
    for m in memes:
        h = m["meme_card_hint"]
        tgt = f"{h['targetMs'] / 1000:.2f}초" if h["targetMs"] is not None else \
            f"없음(틀 파라미터 제안 {json.dumps(h.get('frameParamsHint', {}))})"
        lines += [f"## {m['rank']}. {m['name']} ({m['type']}) — {m['score']}점" + ("  [샘플 자료]" if m["sample"] else ""),
                  f"- 목표 시간(라운드당): {tgt} — {h['targetReason']}",
                  *([f"- 한 판 예상 길이: {h['expectedSessionS']:g}초 "
                     f"({h['rounds']}라운드 x (목표 {h['targetMs'] / 1000:g}초 + 여유 {ROUND_SLACK_S}초)) — "
                     + (f"{MIN_SESSION_S}~{MAX_SESSION_S}초 안" if h["sessionInRange"]
                        else f"⚠ {MIN_SESSION_S}~{MAX_SESSION_S}초 밖")]
                    if h.get("expectedSessionS") is not None else []),
                  f"- 가져오기 방식: {m['use_mode']}"
                  + (f" / ip 감점 −{m['ip_penalty']:g} ({', '.join(m['ip_categories'])})" if m["ip_penalty"] else ""),
                  ""]
        lines += render_popularity(m)
        lines += ["", f"### 배경\n{m['background_line']}", ""]
    return "\n".join(lines)


def render_today(cands: list[Candidate], memes: list[dict[str, Any]], now: datetime,
                 combos: list[dict[str, Any]] | None = None) -> str:
    """combos: pairing.build_combos 결과(상위 3). 없으면 조합 칸은 '후보 부족'."""
    from .pairing import render_combos
    sample = any(c.sample for c in cands) or any(m["sample"] for m in memes)
    lines = [f"# 오늘의 조합 추천 ({now.date().isoformat()})", ""]
    if sample:
        lines += [f"> ⚠ {SAMPLE_MARK}", ""]
    lines += ["## 게임 틀 순위 (상위 5)", "| 순위 | 게임 틀 | 연결된 틀 | 적합도 | 인기도 | 합의도 | 신뢰 |",
              "|---|---|---|---|---|---|---|"]
    for c in cands[:5]:
        lines.append(f"| {c.rank} | {c.name} | {c.frame or '-'} | {c.score} | {c.popularity_total:g}/100 | "
                     f"{c.consensus.get('label', '')} | {c.confidence} |")
    if not cands:
        lines.append("| - | (후보 없음) | | | | | |")
    lines += ["", "## 밈 순위 (상위 5)", "| 순위 | 밈 | 유형 | 점수 | 인기도 | 합의도 | 목표 시간·틀 파라미터 | 가져오기 |",
              "|---|---|---|---|---|---|---|---|"]
    for m in memes[:5]:
        use = "형식·문구·숫자·순간만" if m["ip_penalty"] else "제한 없음"
        h = m["meme_card_hint"]
        tgt = f"{h['targetMs'] / 1000:.2f}초" if h["targetMs"] is not None else json.dumps(h.get("frameParamsHint", {}))
        lines.append(f"| {m['rank']} | {m['name']} | {m['type']} | {m['score']} | {m['popularity_total']:g}/100 | "
                     f"{m['consensus']['label']} | {tgt} | {use} |")
    if not memes:
        lines.append("| - | (밈 입력 없음) | | | | | | |")
    lines += ["", "## 오늘의 조합 추천 (틀 × 밈 상위 3)", ""]
    if not combos:
        lines.append("조합을 만들 후보가 부족합니다(연결된 틀이 있는 게임 또는 밈 없음).")
        return "\n".join(lines) + "\n"
    lines += render_combos(combos)
    return "\n".join(lines)
