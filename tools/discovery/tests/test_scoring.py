from datetime import datetime, timezone

import pytest

from discovery.models import Signal
from discovery.popularity import compute_popularity
from discovery.rules import load_ip_terms
from discovery.scoring import load_weights, score_signal

NOW = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
W = load_weights()
IP = load_ip_terms()


def sig(**kw):
    d = dict(name="테스트게임", url="u", source="s", metrics={"growth": 100000},
             measured_at="2026-10-23T12:00:00+00:00", notes="규칙: 탭한다.",
             traits={"session_seconds": 30, "controls": ["tap"],
                     "score_type": "single_number", "impl_ease": 5})
    d.update(kw)
    return Signal.from_dict(d)


def test_perfect_score_is_100():
    r = score_signal(sig(), W, IP, NOW)
    assert r.passed and r.total == pytest.approx(100.0)


def test_weights_from_file_sum_to_100_without_link_trust():
    keys = ["impl_ease", "session_length", "score_simplicity", "control_simplicity", "signal_strength"]
    assert sum(W[k] for k in keys) == 100
    assert "link_trust_by_status" not in W


@pytest.mark.parametrize("traits_patch,word", [
    ({"session_seconds": 31}, "초"),
    ({"session_seconds": 60}, "초"),
    ({"controls": ["keyboard"]}, "조작"),
    ({"controls": ["tap", "keyboard"]}, "조작"),
    ({"score_type": "unclear"}, "숫자 하나"),
])
def test_required_criteria_fail_gives_zero(traits_patch, word):
    t = sig().traits | traits_patch
    r = score_signal(sig(traits=t), W, IP, NOW)
    assert not r.passed and r.total == 0
    assert any(word in x for x in r.fail_reasons)


@pytest.mark.parametrize("secs", [5, 15, 20, 25, 29, 30])
def test_short_original_games_pass_with_full_length_points(secs):
    # 원본 게임 길이는 상한(30초)만 둔다: 짧은 게임(예: 20초 Stickman Hook)은 탈락하지 않는다
    t = sig().traits | {"session_seconds": secs}
    r = score_signal(sig(traits=t), W, IP, NOW)
    assert r.passed and not r.fail_reasons
    assert r.parts["session_length"] == pytest.approx(15)


def test_session_over_30_fails_but_30_passes():
    assert score_signal(sig(traits=sig().traits | {"session_seconds": 30}), W, IP, NOW).passed
    assert not score_signal(sig(traits=sig().traits | {"session_seconds": 30.5}), W, IP, NOW).passed


def test_ip_penalty_rule_vs_name_only():
    base = score_signal(sig(), W, IP, NOW).total
    rule = score_signal(sig(notes="규칙: 마리오가 점프"), W, IP, NOW)
    name = score_signal(sig(name="포켓몬 아닌 게임"), W, IP, NOW)
    assert rule.ip_penalty == 30 and rule.total == pytest.approx(base - 30)
    assert name.ip_penalty == 10 and name.total == pytest.approx(base - 10)


def test_legacy_metrics_path_stale_halves_strength():
    # online·community가 없는 옛 입력은 metrics growth로 계산(7일 초과는 절반)
    fresh = score_signal(sig(), W, IP, NOW).parts["signal_strength"]
    old = score_signal(sig(measured_at="2026-10-10T00:00:00+00:00"), W, IP, NOW)
    exactly7 = score_signal(sig(measured_at="2026-10-17T12:00:00+00:00"), W, IP, NOW)
    assert old.parts["signal_strength"] == pytest.approx(fresh / 2)
    assert exactly7.parts["signal_strength"] == pytest.approx(fresh)


def test_no_link_parts_in_score():
    r = score_signal(sig(), W, IP, NOW)
    assert "link_trust" not in r.parts


def test_signal_strength_uses_popularity_total_out_of_100():
    s = sig()
    p = compute_popularity(
        [{"platform": "A", "metric": "m", "value_approx": 10**8, "tier": 5, "since": "", "measured_at": ""},
         {"platform": "B", "metric": "m", "value_approx": 10**8, "tier": 5, "since": "", "measured_at": ""},
         {"platform": "C", "metric": "m", "value_approx": 10**8, "tier": 5, "since": "", "measured_at": ""}],
        [{"community": "r/x", "mentions": 10**5, "upvotes_approx": 10**6, "sentiment": "positive", "independent": True},
         {"community": "r/y", "mentions": 10**5, "upvotes_approx": 10**6, "sentiment": "positive", "independent": True},
         {"community": "r/z", "mentions": 10**5, "upvotes_approx": 10**6, "sentiment": "positive", "independent": True}],
        w=W)
    assert p.total == pytest.approx(100)
    assert score_signal(s, W, IP, NOW, p).parts["signal_strength"] == pytest.approx(20)
    half = compute_popularity([], [], w=W)
    assert score_signal(s, W, IP, NOW, half).parts["signal_strength"] == 0


def test_length_and_ease_partial_points():
    r = score_signal(sig(traits={"session_seconds": 30, "controls": ["tap", "swipe"],
                                 "score_type": "single_number", "impl_ease": 3}), W, IP, NOW)
    assert r.parts["impl_ease"] == pytest.approx(18)
    assert r.parts["session_length"] == pytest.approx(15)
    assert r.parts["control_simplicity"] == pytest.approx(12)
