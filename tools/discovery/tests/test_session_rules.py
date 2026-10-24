"""판 길이 30~60초·3라운드 규칙: 경계, 라운드당 목표 3~5초, 한 판 예상 길이 표시, 하루 판 JSON의 rounds."""
import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from discovery import cli, config
from discovery.memes import convert_target, load_memes, run_memes
from discovery.models import Signal
from discovery.pairing import day_plan
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


@pytest.mark.parametrize("secs,ok", [(29, False), (30, True), (60, True), (61, False)])
def test_session_boundaries(secs, ok):
    r = score_signal(_sig(secs), W, IP, NOW)
    assert r.passed is ok
    assert bool(r.fail_reasons) is (not ok)


@pytest.mark.parametrize("sug,ms", [(2, 3000), (3, 3000), (4, 4000), (5, 5000), (6, 5000), (15, 5000)])
def test_round_target_3_to_5(sug, ms):
    assert convert_target("timing", sug)["ms"] == ms


def test_expected_session_formula():
    assert config.expected_session_s(3, 4) == 18
    assert config.expected_session_s(3, 5) == 21


def test_meme_card_shows_expected_session():
    memes = load_memes(FX / "memes.json")
    ranked, _ = run_memes(memes, make_sim_fetch([], memes), W)
    for m in ranked:
        h = m["meme_card_hint"]
        if h["targetMs"] is None:
            continue
        assert h["rounds"] == 3
        assert h["expectedSessionS"] == 3 * (h["targetMs"] / 1000 + config.ROUND_SLACK_S)
        assert h["sessionInRange"] == (30 <= h["expectedSessionS"] <= 60)
    md = render_memes_markdown(ranked)
    assert "한 판 예상 길이" in md and "3라운드 x (목표" in md


def test_plan_json_has_rounds_for_asc_frames():
    memes = load_memes(FX / "memes.json")
    ranked, _ = run_memes(memes, make_sim_fetch([], memes), W)
    plan = day_plan("timing_stop", ranked[0], "2026-10-24", 1)
    assert plan["rounds"] == 3 and plan["scoreRule"] == "sum_of_errors"
    assert plan["frameParams"]["rounds"] == 3
    assert 3000 <= plan["frameParams"]["targetMs"] <= 5000
    desc = day_plan("tap_rush", ranked[0], "2026-10-24", 1)
    assert "rounds" not in desc and "scoreRule" not in desc


def test_today_md_plan_has_rounds(tmp_path):
    out = tmp_path / "o"
    assert cli.main(["run", "--signals", str(FX / "signals.json"), "--out", str(out), "--now", NOW.isoformat()]) == 0
    today = (out / "TODAY.md").read_text(encoding="utf-8")
    plan = json.loads(today.split("### 조합 1:")[1].split("```json")[1].split("```")[0])
    assert plan["frame"] == "timing_stop" and plan["rounds"] == 3 and plan["scoreRule"] == "sum_of_errors"
