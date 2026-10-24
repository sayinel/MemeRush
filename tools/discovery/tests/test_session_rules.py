"""판 길이 30~60초·3라운드 규칙: 경계, 라운드당 목표 3~5초, 한 판 예상 길이 표시, 하루 판 JSON의 rounds."""
import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from discovery import cli, config
from discovery.memes import convert_target, load_memes, run_memes
from discovery.models import Signal
from discovery.pairing import day_plan, plan_meta
from discovery.pipeline import make_sim_fetch, render_memes_markdown
from discovery.rules import load_ip_terms
from discovery.scoring import load_weights, score_signal

FX = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
W, IP = load_weights(), load_ip_terms()


def _sig(secs):
    return Signal.from_dict(dict(name="g", url="u", source="s", metrics={"growth": 1000}, measured_at="2026-10-23T12:00:00+00:00",
                                 notes="규칙: 탭한다.", traits={"session_seconds": secs, "controls": ["tap"],
                                                             "score_type": "single_number", "impl_ease": 5}))


def test_config_values():
    assert (config.MIN_SESSION_S, config.MAX_SESSION_S, config.ROUNDS, config.ROUND_TARGET_RANGE_S) == (30, 60, 3, (3, 5))
    assert (config.ROUND_INTRO_S, config.ROUND_REACT_S, config.FINAL_RESULT_S) == (2, 3, 3)   # PR #18 연출
    assert config.FIRST_DAY_TARGETS_S == (3, 4, 5) and config.NUMBER_MEME_MAX_S == 7
    assert config.MAX_ORIGINAL_GAME_S == 30


@pytest.mark.parametrize("secs,ok", [(5, True), (15, True), (20, True), (29, True), (30, True), (31, False), (60, False)])
def test_original_game_length_has_only_an_upper_bound(secs, ok):
    # 후보 원본 게임: 상한 30초만. 20초 게임(Stickman Hook)은 탈락하지 않는다
    r = score_signal(_sig(secs), W, IP, NOW)
    assert r.passed is ok
    assert bool(r.fail_reasons) is (not ok)
    if not ok:
        assert f"{secs}초" in r.fail_reasons[0]


@pytest.mark.parametrize("sug,ms", [(2, 3000), (3, 3000), (4, 4000), (5, 5000), (6, 5000), (15, 5000)])
def test_round_target_3_to_5(sug, ms):
    assert convert_target("timing", sug)["ms"] == ms


@pytest.mark.parametrize("sug,ms", [(2, 3000), (6.7, 6700), (7, 7000), (15, 7000)])
def test_number_meme_target_up_to_7(sug, ms):
    assert convert_target("number", sug)["ms"] == ms


@pytest.mark.parametrize("targets,total", [
    ([3, 4, 5], 30),        # 첫날: 3 x (2+3) + 12 + 3
    ([4, 4, 4], 30),
    ([5, 5, 5], 33),
    ([3, 3, 3], 27),
    ([7, 7, 7], 39),
    ([6.7, 6.7, 6.7], 38.1)])
def test_expected_session_by_hand(targets, total):
    # 손으로 계산한 값: 라운드마다 소개 2 + 목표 + 반응 3, 마지막에 결과 3
    assert config.expected_session_s(targets) == pytest.approx(total)


def test_round_targets_ramp_and_single_value():
    assert config.round_targets_s() == [3, 4, 5]
    assert config.round_targets_s(3, 6.7) == [6.7, 6.7, 6.7]   # 숫자 하나면 모든 라운드에 같은 값
    assert config.round_targets_s(5) == [3, 4, 5, 5, 5]


def test_first_day_session_is_30_and_in_range():
    est = config.expected_session_s(config.round_targets_s())
    assert est == 30 and config.session_in_range(est)
    assert not config.session_in_range(29.9) and config.session_in_range(60) and not config.session_in_range(60.1)


def test_meme_card_shows_expected_session():
    memes = load_memes(FX / "memes.json")
    ranked, _ = run_memes(memes, make_sim_fetch([], memes), W, now=NOW)
    # 손으로 계산한 값(이름 → 예상 길이, 범위 안 여부). 형식 밈은 첫날 3·4·5초 = 30초
    expected = {"6 7": (38.1, True), "Nobody: / Me:": (30, True), "Wait for it": (33, True),
                "2 5": (27, False), "노래 립싱크 챌린지": (30, True)}
    assert {m["name"]: (m["meme_card_hint"]["expectedSessionS"], m["meme_card_hint"]["sessionInRange"])
            for m in ranked} == expected
    md = render_memes_markdown(ranked)
    assert "한 판 예상 길이: 30초" in md and "소개 2초 + 목표 + 반응 3초" in md and "마지막 결과 3초" in md
    assert "⚠ 30~60초 밖" in md  # "2 5"(27초)


def test_plan_file_has_spec_6_shape_and_meta_is_separate():
    memes = load_memes(FX / "memes.json")
    ranked, _ = run_memes(memes, make_sim_fetch([], memes), W, now=NOW)
    plan = day_plan("timing_stop", ranked[0], "2026-10-24", 1)  # "6 7": 6.7초
    assert set(plan) == {"id", "title", "frame", "frameParams", "seed", "meme"}
    assert plan["frameParams"] == {"rounds": 3, "targetMs": [6700, 6700, 6700], "visibleMs": 1500}
    assert plan_meta("timing_stop", plan) == {"rounds": 3, "scoreRule": "sum", "scoreDirection": "asc",
                                              "expectedSessionS": 38.1, "sessionInRange": True}
    gauge = day_plan("gauge_stop", ranked[0], "2026-10-24", 1)
    assert plan_meta("gauge_stop", gauge)["scoreDirection"] == "asc"
    assert plan_meta("gauge_stop", gauge)["expectedSessionS"] is None


def test_today_md_plan_and_meta(tmp_path):
    out = tmp_path / "o"
    assert cli.main(["run", "--signals", str(FX / "signals.json"), "--out", str(out), "--now", NOW.isoformat()]) == 0
    today = (out / "TODAY.md").read_text(encoding="utf-8")
    plan = json.loads(today.split("### 조합 1:")[1].split("```json")[1].split("```")[0])
    assert plan["frame"] == "timing_stop" and "rounds" not in plan and "scoreRule" not in plan
    assert plan["frameParams"]["rounds"] == 3
    combos = json.loads((out / "combos.json").read_text(encoding="utf-8"))
    assert combos[0]["plan_meta"] == {"rounds": 3, "scoreRule": "sum", "scoreDirection": "asc",
                                      "expectedSessionS": 38.1, "sessionInRange": True}
    assert "scoreRule `sum`" in today and "한 판 예상 38.1초" in today
