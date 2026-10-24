"""밈 후보: 유형 변환, 라운드당 목표 시간 3~5초 보정, 안전 탈락, ip 감점, 순위, TODAY.md."""
import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from discovery import cli
from discovery.config import DEFAULT_ROUND_TARGET_S
from discovery.memes import Meme, convert_target, ip_assessment, load_memes, run_memes, safety_reasons
from discovery.pipeline import make_sim_fetch, render_memes_markdown
from discovery.scoring import load_weights

FX = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
W = load_weights()


def _run():
    memes = load_memes(FX / "memes.json")
    return memes, run_memes(memes, make_sim_fetch([], memes), W)


def test_convert_number_uses_number_as_seconds():
    t = convert_target("number", 4.7)
    assert t["seconds"] == 4.7 and t["ms"] == 4700 and not t["clamped"] and "4.70" in t["reason"]


def test_convert_timing_uses_length_to_moment():
    t = convert_target("timing", 3.25)
    assert t["ms"] == 3250 and "순간" in t["reason"]


def test_convert_format_is_always_default_round_target():
    for sug in (None, 4, 99):
        t = convert_target("format", sug)
        assert t["ms"] == DEFAULT_ROUND_TARGET_S * 1000 and "4.00" in t["reason"]


@pytest.mark.parametrize("mtype,sug,ms", [("number", 2.5, 3000), ("number", 0.1, 3000), ("timing", 22, 5000),
                                          ("number", 3, 3000), ("timing", 5, 5000), ("number", 5.01, 5000)])
def test_target_clamped_to_round_range_with_reason(mtype, sug, ms):
    t = convert_target(mtype, sug)
    assert t["ms"] == ms
    assert t["clamped"] == (sug not in (3, 5)) and ("범위 밖" in t["reason"]) == t["clamped"]


def test_missing_suggestion_falls_back_to_default_with_reason():
    t = convert_target("number", None)
    assert t["ms"] == DEFAULT_ROUND_TARGET_S * 1000 and "제안 값이 없어" in t["reason"]


@pytest.mark.parametrize("flag,cat", [("특정인 조롱", "특정인 조롱"), ("hate speech", "혐오"), ("혐오 표현", "혐오"),
                                      ("drugs", "약물"), ("성적 암시", "성적 암시"), ("뭔가 위험", "기타")])
def test_safety_flags_reject_with_reason(flag, cat):
    m = Meme.from_dict({"name": "x", "safety_flags": [flag]})
    assert safety_reasons(m) and cat in safety_reasons(m)[0]
    ranked, rej = run_memes([m], lambda u, t: (200, ""), W)
    assert not ranked and "안전 규칙 위반" in rej[0]["reasons"][0]


def test_ip_music_trademark_person_penalized_and_limited_use():
    m = Meme.from_dict({"name": "x", "ip_risks": ["음원: 곡", "상표 로고", "실존 인물 얼굴"]})
    a = ip_assessment(m, W)
    assert a["categories"] == ["음원", "상표", "실존 인물"] and a["penalty"] == 30
    assert "형식·문구·숫자·순간만 가져오기" in a["use_mode"]
    none = ip_assessment(Meme.from_dict({"name": "y"}), W)
    assert none["penalty"] == 0 and "만 가져오기" not in none["use_mode"]


def test_fixture_ranking_and_rejections():
    exp = json.loads((FX / "expected_rank.json").read_text(encoding="utf-8"))
    _, (ranked, rej) = _run()
    assert [m["name"] for m in ranked] == exp["meme_top5"]
    got = {r["name"]: " ".join(r["reasons"]) for r in rej}
    assert set(got) == set(exp["meme_rejected"])
    for n, word in exp["meme_rejected"].items():
        assert word in got[n], (n, got[n])


def test_fixture_type_conversions_and_hints():
    _, (ranked, _) = _run()
    by = {m["name"]: m for m in ranked}
    h67 = by["6 7"]["meme_card_hint"]
    assert h67["type"] == "number" and h67["targetMs"] == 5000 and "범위 밖" in h67["targetReason"]
    assert by["Wait for it"]["meme_card_hint"]["targetMs"] == 5000 and "범위 밖" in by["Wait for it"]["meme_card_hint"]["targetReason"]
    assert by["2 5"]["meme_card_hint"]["targetMs"] == 3000
    assert by["Nobody: / Me:"]["meme_card_hint"]["targetMs"] == 4000
    for m in ranked:
        ctx = m["meme_context"]
        assert set(ctx) <= {"summary", "since", "url"} and ctx["summary"] and ctx["since"]
        assert set(m["meme_card_hint"]) == {"type", "targetMs", "targetReason", "rounds", "expectedSessionS",
                                            "sessionInRange"}
        assert 3000 <= m["meme_card_hint"]["targetMs"] <= 5000
    assert by["6 7"]["meme_context"]["url"] == "https://memes.example.test/ev/67-tiktok"


def test_fixture_ip_meme_marked_and_penalized():
    _, (ranked, _) = _run()
    ip = next(m for m in ranked if m["name"] == "노래 립싱크 챌린지")
    assert ip["ip_penalty"] == 20 and "형식·문구·숫자·순간만 가져오기" in ip["use_mode"]
    assert ip["score"] == pytest.approx(ip["popularity_total"] - 20)


def test_single_source_and_fading_memes_score_lower():
    memes, (ranked, rej) = _run()
    full = {m.name: m for m in memes}
    from discovery.popularity import compute_popularity
    solo = compute_popularity(full["혼자만 뜬 짤"].online, full["혼자만 뜬 짤"].community, False, False, W)
    assert solo.consensus["single_source"] and solo.scores["consensus_factor"] == 0.7
    fade = full["한물간 챌린지"]
    a = compute_popularity(fade.online, fade.community, True, False, W)
    b = compute_popularity(fade.online, fade.community, False, False, W)
    assert a.total == pytest.approx(b.total - 10)


def test_dead_meme_link_does_not_reject():
    memes, (ranked, rej) = _run()
    solo = next(m for m in memes if m.name == "혼자만 뜬 짤")
    r = next(x for x in rej if x["name"] == "혼자만 뜬 짤")
    assert "링크" not in " ".join(r["reasons"])       # 404였지만 인기 근거 때문에 점수만 낮고 탈락 사유는 순위뿐
    assert solo.online[0]["sim"]["status"] == 404


def test_needs_review_meme_excluded_with_reason():
    m = Meme.from_dict({"name": "x", "needs_review": True, "review_reasons": ["인기 근거 없음"]})
    ranked, rej = run_memes([m], lambda u, t: (200, ""), W)
    assert not ranked and "needs_review" in rej[0]["reasons"][0] and "인기 근거 없음" in rej[0]["reasons"][0]


def test_run_writes_today_md_with_combo(tmp_path):
    out = tmp_path / "o"
    assert cli.main(["run", "--signals", str(FX / "signals.json"), "--out", str(out), "--now", NOW.isoformat()]) == 0
    today = (out / "TODAY.md").read_text(encoding="utf-8")
    for part in ("## 게임 틀 순위 (상위 5)", "## 밈 순위 (상위 5)", "## 오늘의 조합 추천 (틀 × 밈 상위 3)",
                 "샘플 자료", "### 조합 1:", "### 조합 2:", "### 조합 3:"):
        assert part in today, part
    assert "### 조합 4:" not in today
    assert today.count("```json") == 3  # 조합마다 하루 판 초안 JSON 하나
    first = today.split("### 조합 1:")[1]
    plan = json.loads(first.split("```json")[1].split("```")[0])
    assert plan["frame"] == "timing_stop" and plan["seed"] == "2026-10-24" and plan["id"] == "2026-10-24"
    assert plan["meme"]["summary"] and plan["frameParams"]["targetMs"] == 5000
    assert "### 조합 1: timing_stop × 6 7" in today
    ms = json.loads((out / "memes.json").read_text(encoding="utf-8"))
    assert len(ms) == 5
    md = render_memes_markdown(ms)
    for part in ("### 온라인 인기도", "### 커뮤니티 인기도", "### 합의도", "### 식는 신호", "### 인기도 점수", "샘플 자료"):
        assert part in md


def test_run_without_memes_still_writes_today(tmp_path):
    sig = tmp_path / "s.json"
    sig.write_text((FX / "signals.json").read_text(encoding="utf-8"), encoding="utf-8")
    out = tmp_path / "o"
    assert cli.main(["run", "--signals", str(sig), "--out", str(out), "--now", NOW.isoformat()]) == 0
    assert "밈 입력 없음" in (out / "TODAY.md").read_text(encoding="utf-8")
