"""틀 선택: frames, 추론 규칙, 밈 세분 분류, 조합 점수, 최근 사용 감점, decide, 실제 조사 자료 통합."""
import json
from datetime import date, datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

from discovery import cli
from discovery.frames import FRAMES, clamp_params, guess_frame
from discovery.infer import infer_controls, infer_score_type, infer_session_seconds
from discovery.ingest import parse_text
from discovery.memes import Meme, classify_type, convert_target, frame_params_hint, load_memes, run_memes
from discovery.pairing import (best_frame_for_meme, build_combos, ease_factor, fit_score, load_history,
                               record_decision, recency_factor)
from discovery.pipeline import make_sim_fetch, run_pipeline
from discovery.sources.file_source import FileSource

FX = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
TODAY = date(2026, 10, 24)


# ---------- frames ----------

def test_six_frames_with_spec_fields():
    assert list(FRAMES) == ["timing_stop", "tap_rush", "swipe_dodge", "gauge_stop", "outline_trace", "merge_drop"]
    assert {f.difficulty_score for f in FRAMES.values()} == {5, 3, 1}
    assert FRAMES["timing_stop"].score_direction == "asc" and FRAMES["tap_rush"].score_direction == "desc"
    assert FRAMES["merge_drop"].difficulty == "높음" and FRAMES["swipe_dodge"].difficulty == "중간"
    for f in FRAMES.values():
        assert f.fits and f.validation and f.params
        assert clamp_params(f.id, {}) == f.default_params()


def test_clamp_params_to_range():
    assert clamp_params("tap_rush", {"bpm": 999, "durationMs": 10})["bpm"] == 180
    assert clamp_params("tap_rush", {"durationMs": 10})["durationMs"] == 30000  # 한 판 30~60초
    assert clamp_params("outline_trace", {"shape": "banana"})["shape"] == "circle"


@pytest.mark.parametrize("text,frame", [
    ("숨은 타이머를 목표에 멈춘다", "timing_stop"), ("박자에 맞춰 연타", "tap_rush"),
    ("장애물을 피하고 통과", "swipe_dodge"), ("게이지가 구간에 올 때 탭", "gauge_stop"),
    ("외곽선을 따라 그어", "outline_trace"), ("같은 과일을 합쳐 큰 걸 만든다", "merge_drop"),
    ("경우에 따라 다르다", None), ("", None)])
def test_guess_frame_rules(text, frame):
    assert guess_frame(text)[0] == frame


# ---------- 추론 규칙 ----------

def test_infer_controls_words():
    assert infer_controls("탭/스와이프") == ["tap", "swipe"]
    assert infer_controls("탭앤홀드로 로프") == ["tap", "hold"]
    assert infer_controls("누르고 있다가 드래그") == ["hold", "drag"]
    assert infer_controls("그냥 본다") == []


def test_infer_session_seconds():
    assert infer_session_seconds("15초 안에") == 15
    assert infer_session_seconds("20~30초 만에") == 30
    assert infer_session_seconds("1초 직관성, 0.1초 재시작") is None
    assert infer_session_seconds("규칙에 없음", "30초 내") == 30  # 규칙 글에 없으면 다음 글
    assert infer_session_seconds("숫자 없음") is None


def test_infer_score_type_words():
    for w in ("점수", "횟수", "기록", "걸린 시간"):
        assert infer_score_type(f"{w}를 센다") == "single_number"
    assert infer_score_type("제한 시간 내에 즐긴다") is None


GAME_TXT = """### 1. 연타 게임
* **한 줄 규칙**: 박자에 맞춰 화면을 탭/스와이프하는 20~30초짜리 리듬 게임.
* **온라인 인기도 근거**: YouTube 조회수 300만 회.
* **인기 이유 두 가지**:
  1. 점수 인증이 쉽다.
* **출처 이름과 주소**: 어딘가 (https://x.test/a)

### 2. 틀 없는 게임
* **한 줄 규칙**: 화면을 탭하며 구경하는 15초 동안 점수를 센다.
* **온라인 인기도 근거**: YouTube 조회수 300만 회.
* **출처 이름과 주소**: 어딘가 (https://x.test/b)
"""


def test_ingest_infers_traits_and_frame_with_inferred_flag():
    a, b = parse_text(GAME_TXT, "game")
    assert a["traits"]["controls"] == ["tap", "swipe"] and a["traits"]["session_seconds"] == 30
    assert a["traits"]["score_type"] == "single_number" and a["traits"]["inferred"] is True
    assert a["frame_guess"] == "tap_rush" and not a["needs_review"]
    assert any("추론값" in n for n in a["parse_notes"])
    assert b["frame_guess"] is None and b["traits"]["inferred"] is True and not b["needs_review"]


def test_no_frame_rejected_and_inferred_card_marked():
    from discovery.models import Signal
    sigs = [Signal.from_dict(d) for d in parse_text(GAME_TXT, "game")]
    cands, rej = run_pipeline(sigs, make_sim_fetch(sigs), now=NOW)
    assert [c.name for c in cands] == ["연타 게임"]
    c = cands[0]
    assert c.frame == "tap_rush" and c.inferred and c.confidence.startswith("낮음")
    assert len(rej) == 1 and "구현할 틀 없음" in rej[0]["reasons"][0]
    from discovery.pipeline import render_markdown
    assert "추론값" in render_markdown(cands)


def test_explicit_traits_not_marked_inferred():
    (g,) = parse_text("### 1. A\n* **이름**: A\n* **규칙**: 탭해서 멈춘다\n* **조작**: 탭\n* **한 판 길이**: 15초\n"
                      "* **점수**: 숫자 하나\n* **온라인 인기도 근거**: YouTube 조회수 300만 회\n", "game")
    assert "inferred" not in g["traits"] and g["frame_guess"] == "timing_stop"


# ---------- 밈 세분 분류 ----------

@pytest.mark.parametrize("summary,hint,t", [
    ("박자에 맞춰 칼박자로 바운스", "", "rhythm"), ("신나는 안무 댄스 챌린지", "", "rhythm"),
    ("남들 파티할 때 단순 노동 기술을 자랑", "", "obstacle"), ("월요일 출근의 고통", "", "obstacle"),
    ("숫자 67만 외치는 유행", "", "number"), ("기다렸다 터지는 순간", "", "timing"),
    ("사진을 넘기며 사과하는 밈", "연속 탭하는 게임", "format"),
    ("사진을 넘기며 사과하는 밈", "박자 맞추는 게임", "rhythm"), ("", "", "format")])
def test_classify_type(summary, hint, t):
    assert classify_type(summary, hint) == t


def test_rhythm_obstacle_suggest_frame_params_not_target_time():
    for t in ("rhythm", "obstacle"):
        c = convert_target(t, 7)
        assert c["ms"] is None and "틀 파라미터" in c["reason"]
    assert frame_params_hint("rhythm", "칼박자 바운스") == {"bpm": 140}
    assert frame_params_hint("rhythm", "100 BPM 곡") == {"bpm": 100}
    assert frame_params_hint("rhythm", "999bpm")["bpm"] == 180
    assert frame_params_hint("obstacle", "순식간에 스와이프") == {"speed": 5}
    assert frame_params_hint("obstacle", "월요일") == {"speed": 3}
    assert frame_params_hint("number", "숫자") == {}


def test_existing_target_rules_unchanged_for_number_timing_format():
    assert convert_target("number", 4.7)["ms"] == 4700 and convert_target("timing", 22)["ms"] == 5000
    assert convert_target("format", 3)["ms"] == 4000


def test_meme_without_type_is_classified_and_ranked_with_hint():
    m = Meme.from_dict({"name": "춤", "summary": "칼박자에 맞춰 춤추는 밈",
                        "online": [{"platform": "TikTok", "metric": "조회수", "value_approx": 5e6, "tier": 4}]})
    assert m.type == "rhythm"
    ranked, _ = run_memes([m], lambda u, t: (200, ""))
    h = ranked[0]["meme_card_hint"]
    assert h["targetMs"] is None and h["frameParamsHint"] == {"bpm": 140} and ranked[0]["frame_params_hint"]


# ---------- 조합 점수 ----------

def _cand(frame, pop, name=None, inferred=False):
    return SimpleNamespace(frame=frame, popularity_total=pop, name=name or f"게임-{frame}", inferred=inferred)


def _meme(name, mtype, pop):
    tgt = {"number": 6700, "timing": 8000, "format": 10000}.get(mtype)
    hint = {"type": mtype, "targetMs": tgt, "targetReason": "r"}
    if mtype == "rhythm":
        hint["frameParamsHint"] = {"bpm": 140}
    return {"name": name, "type": mtype, "popularity_total": pop, "meme_card_hint": hint,
            "meme_context": {"summary": "s", "since": "2026-10"}, "use_mode": "u"}


def test_fit_scores():
    assert fit_score("tap_rush", "rhythm") == 1.0
    assert fit_score("tap_rush", "timing") == 0.6      # rhythm에서 한 칸
    assert fit_score("swipe_dodge", "rhythm") == 0.6
    assert fit_score("swipe_dodge", "number") == 0.3
    assert fit_score("timing_stop", "number") == 1.0 and fit_score("outline_trace", "format") == 1.0
    assert ease_factor("timing_stop") == 1.0 and ease_factor("merge_drop") == 0.6


def test_combo_score_formula_and_plan_shape():
    (c,) = build_combos([_cand("tap_rush", 80), _cand("tap_rush", 60)], [_meme("춤", "rhythm", 50)], [], TODAY, top_n=1)
    assert c["score"] == pytest.approx(0.8 * 0.5 * 1.0 * 1.0 * 100)  # 최고 인기도 80 사용
    p = c["plan"]
    assert set(p) == {"id", "title", "frame", "frameParams", "seed", "meme"}
    assert p["frame"] == "tap_rush" and p["frameParams"]["bpm"] == 140 and p["seed"] == "2026-10-24"
    assert p["title"] == "MemeRush Daily #001" and p["meme"]["name"] == "춤"


def test_fit_beats_popularity_when_much_better():
    combos = build_combos([_cand("timing_stop", 60), _cand("tap_rush", 60)],
                          [_meme("춤", "rhythm", 60)], [], TODAY)
    assert combos[0]["frame"] == "tap_rush" and combos[0]["parts"]["fit"] == 1.0


def test_recent_same_frame_two_days_halves_score_and_other_frame_rises():
    cands = [_cand("timing_stop", 70), _cand("gauge_stop", 60)]
    memes = [_meme("숫자", "number", 70)]
    base = build_combos(cands, memes, [], TODAY)
    assert base[0]["frame"] == "timing_stop"
    hist = [{"date": "2026-10-23", "frame": "timing_stop"}, {"date": "2026-10-22", "frame": "timing_stop"}]
    pen = build_combos(cands, memes, hist, TODAY)
    top = pen[0]
    assert top["frame"] == "gauge_stop"
    ts = next(c for c in pen if c["frame"] == "timing_stop")
    assert ts["parts"]["recency"] == 0.5 and ts["score"] == pytest.approx(base[0]["score"] * 0.5, abs=0.01)


def test_recency_needs_both_days():
    one = [{"date": "2026-10-23", "frame": "timing_stop"}]
    assert recency_factor("timing_stop", one, TODAY) == 1.0
    gap = one + [{"date": "2026-10-21", "frame": "timing_stop"}]
    assert recency_factor("timing_stop", gap, TODAY) == 1.0
    mixed = one + [{"date": "2026-10-22", "frame": "tap_rush"}]
    assert recency_factor("timing_stop", mixed, TODAY) == 1.0


def test_no_frames_or_memes_gives_no_combos():
    assert build_combos([], [_meme("a", "number", 50)], [], TODAY) == []
    assert build_combos([_cand(None, 50)], [_meme("a", "number", 50)], [], TODAY) == []
    assert build_combos([_cand("timing_stop", 50)], [], [], TODAY) == []


# ---------- decide ----------

def test_decide_records_history_and_replaces_same_date(tmp_path):
    out = tmp_path / "o"
    assert cli.main(["decide", "--date", "2026-10-24", "--frame", "timing_stop", "--out", str(out)]) == 0
    assert cli.main(["decide", "--date", "2026-10-24", "--frame", "tap_rush", "--out", str(out)]) == 0
    assert cli.main(["decide", "--date", "2026-10-23", "--frame", "gauge_stop", "--out", str(out)]) == 0
    assert load_history(out / "history.jsonl") == [{"date": "2026-10-23", "frame": "gauge_stop"},
                                                   {"date": "2026-10-24", "frame": "tap_rush"}]
    assert cli.main(["decide", "--date", "2026-10-24", "--frame", "nope", "--out", str(out)]) == 1
    with pytest.raises(ValueError):
        record_decision(out / "history.jsonl", "not-a-date", "tap_rush")


def test_run_uses_history_penalty_in_today(tmp_path):
    out = tmp_path / "o"
    args = ["run", "--signals", str(FX / "signals.json"), "--now", NOW.isoformat()]
    assert cli.main(args + ["--out", str(tmp_path / "base")]) == 0
    base = json.loads((tmp_path / "base" / "combos.json").read_text(encoding="utf-8"))
    for d in ("2026-10-23", "2026-10-22"):
        record_decision(out / "history.jsonl", d, "timing_stop")
    assert cli.main(args + ["--out", str(out)]) == 0
    combos = json.loads((out / "combos.json").read_text(encoding="utf-8"))
    assert base[0]["frame"] == "timing_stop" and base[0]["parts"]["recency"] == 1.0
    ts = next(c for c in combos if c["frame"] == "timing_stop")
    assert ts["parts"]["recency"] == 0.5 and ts["score"] < base[0]["score"]
    assert any(c["frame"] != "timing_stop" for c in combos)


# ---------- 실제 조사 자료 통합 ----------

GAMES = FX / "guru_games_out.txt"
MEMES = FX / "guru_memes_out.txt"


def test_real_guru_games_and_memes_end_to_end(tmp_path, capsys):
    sig, mem, out = tmp_path / "signals.json", tmp_path / "memes.json", tmp_path / "out"
    assert cli.main(["ingest", "--text", str(GAMES), "--kind", "game", "--out", str(sig)]) == 0
    assert cli.main(["ingest", "--text", str(MEMES), "--kind", "meme", "--out", str(mem)]) == 0
    games = json.loads(sig.read_text(encoding="utf-8"))["signals"]
    assert len(games) == 10 and not any(g["needs_review"] for g in games)  # 추론으로 통과
    linked = [g for g in games if g["frame_guess"]]
    assert len(linked) >= 6
    assert all(g["traits"]["inferred"] for g in games)

    assert cli.main(["run", "--signals", str(sig), "--memes", str(mem), "--out", str(out),
                     "--now", NOW.isoformat()]) == 0
    cands = json.loads((out / "candidates.json").read_text(encoding="utf-8"))
    rej = json.loads((out / "rejected.json").read_text(encoding="utf-8"))
    all_frames = {g["name"]: g["frame_guess"] for g in games}
    assert len(set(f for f in all_frames.values() if f)) >= 3
    assert any("구현할 틀 없음" in " ".join(r["reasons"]) for r in rej)  # 드라이브 매드
    assert all(c["inferred"] and c["frame"] for c in cands)

    ranked = json.loads((out / "memes.json").read_text(encoding="utf-8"))
    assert len(ranked) == 5
    assert {m["type"] for m in ranked} >= {"rhythm", "obstacle", "format"}
    best = {best_frame_for_meme(m["type"]) for m in ranked}
    assert len(best) >= 3 and best <= set(FRAMES)
    for m in ranked:
        if m["type"] in ("rhythm", "obstacle"):
            assert m["meme_card_hint"]["targetMs"] is None and m["frame_params_hint"]

    combos = json.loads((out / "combos.json").read_text(encoding="utf-8"))
    assert len(combos) == 3
    today = (out / "TODAY.md").read_text(encoding="utf-8")
    assert today.count("```json") == 3 and "추론값" in today
    plan = combos[0]["plan"]
    assert FRAMES[plan["frame"]] and plan["frameParams"] and plan["seed"] == "2026-10-24"
