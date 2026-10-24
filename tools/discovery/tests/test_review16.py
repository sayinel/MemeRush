"""PR 16 리뷰 반영 시험: 저작권 용어 단어 경계, 입력 덮어쓰기 방지, 한국 시간 날짜, 링크 한 번만 열기와 본문 크기 제한,
7일 감쇠(실제 점수 경로), 반복 동작 밈의 틀."""
import json
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from discovery import cli, link_check
from discovery.config import KST, parse_now, to_kst
from discovery.memes import Meme, classify_type, run_memes
from discovery.models import Signal
from discovery.pairing import best_frame_for_meme, fit_score
from discovery.pipeline import make_sim_fetch, run_pipeline
from discovery.popularity import compute_popularity, is_stale, measured_end
from discovery.rules import find_ip_hits, load_ip_terms
from discovery.scoring import load_weights, score_signal

FX = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
W, IP = load_weights(), load_ip_terms()


# ---------- 저작권 용어: 영문은 단어 경계 ----------

def _hits(name, notes=""):
    return find_ip_hits(Signal.from_dict(dict(name=name, url="", source="", notes=notes)), IP)


@pytest.mark.parametrize("text", ["ultrasonic dash", "debts", "marionette", "pokemonic", "bts2"])
def test_ip_terms_do_not_match_inside_other_english_words(text):
    assert _hits(text, f"규칙: {text}") == []


@pytest.mark.parametrize("text,term", [("Super Mario run", "mario"), ("mario", "mario"), ("sonic!", "sonic"),
                                       ("BTS's song", "bts"), ("the Pokemon-like", "pokemon"),
                                       ("Let it go", "let it go")])
def test_ip_terms_match_whole_english_words(text, term):
    assert [h["term"] for h in _hits("x", f"규칙: {text}")] == [term]


def test_ip_terms_korean_still_substring_and_name_vs_rule():
    assert _hits("포켓몬 아닌 게임")[0]["where"] == "name"
    assert _hits("x", "규칙: 마리오가 점프")[0]["where"] == "rule"
    r = score_signal(Signal.from_dict(dict(name="ultrasonic", url="", source="", notes="규칙: 탭", metrics={"growth": 1},
                                           traits={"session_seconds": 20, "controls": ["tap"],
                                                   "score_type": "single_number", "impl_ease": 5})), W, IP, NOW)
    assert r.passed and r.ip_penalty == 0     # 30점 감점으로 탈락하던 오탐


# ---------- 입력 덮어쓰기 방지 ----------

def test_run_refuses_to_overwrite_its_input_files(tmp_path, capsys):
    out = tmp_path / "out"
    out.mkdir()
    shutil.copy(FX / "signals.json", out / "signals.json")
    shutil.copy(FX / "memes.json", out / "memes.json")
    memes_before = (out / "memes.json").read_bytes()
    rc = cli.main(["run", "--signals", str(out / "signals.json"), "--out", str(out), "--now", NOW.isoformat()])
    assert rc == 2
    assert (out / "memes.json").read_bytes() == memes_before          # 입력이 순위 결과로 바뀌지 않음
    assert not (out / "TODAY.md").exists()                            # 아무것도 쓰지 않고 멈춤
    assert "덮어쓰" in capsys.readouterr().err


def test_run_refuses_when_explicit_memes_input_is_an_output_name(tmp_path):
    out = tmp_path / "out"
    out.mkdir()
    shutil.copy(FX / "memes.json", out / "memes.json")
    rc = cli.main(["run", "--signals", str(FX / "signals.json"), "--memes", str(out / "memes.json"),
                   "--out", str(out), "--now", NOW.isoformat()])
    assert rc == 2


def test_run_into_other_folder_is_fine(tmp_path):
    src = tmp_path / "in"
    src.mkdir()
    shutil.copy(FX / "signals.json", src / "signals.json")
    shutil.copy(FX / "memes.json", src / "memes.json")
    assert cli.main(["run", "--signals", str(src / "signals.json"), "--out", str(tmp_path / "out"),
                     "--now", NOW.isoformat()]) == 0
    assert (src / "memes.json").read_bytes() == (FX / "memes.json").read_bytes()


# ---------- 한국 시간 날짜 ----------

def test_parse_now_and_to_kst():
    assert KST.utcoffset(None) == timedelta(hours=9)
    assert to_kst(datetime(2026, 10, 23, 20, 0, tzinfo=timezone.utc)).date().isoformat() == "2026-10-24"
    assert to_kst(datetime(2026, 10, 24, 1, 0)).date().isoformat() == "2026-10-24"        # 시간대 없으면 한국 시간
    assert parse_now("2026-10-23T20:00:00Z").astimezone(KST).date().isoformat() == "2026-10-24"
    assert parse_now("2026-10-24T08:59:00").date().isoformat() == "2026-10-24"
    assert parse_now().tzinfo is not None


@pytest.mark.parametrize("now_iso,day", [
    ("2026-10-23T20:00:00+00:00", "2026-10-24"),   # UTC로는 전날 20시, 한국은 24일 05시
    ("2026-10-24T08:59:00+09:00", "2026-10-24"),
    ("2026-10-24T23:30:00+00:00", "2026-10-25"),   # 한국은 25일 08시 30분
])
def test_run_uses_korea_date_for_plan_id_and_seed(tmp_path, now_iso, day):
    out = tmp_path / "o"
    assert cli.main(["run", "--signals", str(FX / "signals.json"), "--out", str(out), "--now", now_iso]) == 0
    today = (out / "TODAY.md").read_text(encoding="utf-8")
    assert today.startswith(f"# 오늘의 조합 추천 ({day})")
    combos = json.loads((out / "combos.json").read_text(encoding="utf-8"))
    assert all(c["plan"]["id"] == day and c["plan"]["seed"] == day for c in combos)


def test_recent_use_penalty_counts_days_in_korea_time(tmp_path):
    out = tmp_path / "o"
    for d in ("2026-10-23", "2026-10-24"):
        cli.main(["decide", "--date", d, "--frame", "timing_stop", "--out", str(out)])
    # UTC로는 10-24 20:00이라 "어제·그제"가 10-23·10-22지만, 한국은 10-25 05:00이라 어제·그제가 10-24·10-23
    assert cli.main(["run", "--signals", str(FX / "signals.json"), "--out", str(out),
                     "--now", "2026-10-24T20:00:00+00:00"]) == 0
    combos = json.loads((out / "combos.json").read_text(encoding="utf-8"))
    ts = next(c for c in combos if c["frame"] == "timing_stop")
    assert ts["plan"]["id"] == "2026-10-25" and ts["parts"]["recency"] == 0.5


# ---------- 링크: 한 번만 열기, 본문 크기 제한 ----------

def test_online_run_opens_each_link_once(tmp_path, monkeypatch):
    calls = []

    def fake(url, timeout):
        calls.append(url)
        return 200, "스톱워치 타이머 정지 6 7"

    monkeypatch.setattr(cli, "httpx_fetch", fake)
    assert cli.main(["run", "--signals", str(FX / "signals.json"), "--out", str(tmp_path / "o"), "--online",
                     "--now", NOW.isoformat()]) == 0
    assert calls and len(calls) == len(set(calls))                  # 같은 URL을 두 번 열지 않음
    assert "https://games.example.test/stopwatch-stop" in calls
    assert "https://memes.example.test/ev/67-tiktok" in calls


def test_online_run_gives_same_ranking_as_offline_when_links_do_not_matter(tmp_path, monkeypatch):
    monkeypatch.setattr(cli, "httpx_fetch", lambda u, t: (404, ""))
    assert cli.main(["run", "--signals", str(FX / "signals.json"), "--out", str(tmp_path / "on"), "--online",
                     "--now", NOW.isoformat()]) == 0
    assert cli.main(["run", "--signals", str(FX / "signals.json"), "--out", str(tmp_path / "off"),
                     "--now", NOW.isoformat()]) == 0
    names = lambda d: [c["name"] for c in json.loads((tmp_path / d / "candidates.json").read_text(encoding="utf-8"))]
    assert names("on") == names("off")       # 링크 열림은 점수·순위에 쓰이지 않는다(사장님 결정)


def test_memoize_fetch_caches_results_and_errors():
    seen = []

    def fetch(url, timeout):
        seen.append(url)
        if url.endswith("bad"):
            raise TimeoutError(url)
        return 200, "ok"

    f = link_check.memoize_fetch(fetch)
    assert f("https://a/x", 1) == (200, "ok") and f("https://a/x", 1) == (200, "ok")
    for _ in range(2):
        with pytest.raises(TimeoutError):
            f("https://a/bad", 1)
    assert seen == ["https://a/x", "https://a/bad"]
    assert link_check.check_link("https://a/bad", "n", f) == link_check.UNVERIFIED


def test_read_capped_stops_reading_at_limit():
    pulled = []

    def chunks():
        for i in range(1000):
            pulled.append(i)
            yield b"x" * 100

    body = link_check.read_capped(chunks(), 250)
    assert len(body) == 250 and len(pulled) == 3          # 3조각(300바이트)만 읽고 멈춤
    assert link_check.read_capped(iter([b"ab", b"cd"]), 100) == b"abcd"


def test_httpx_fetch_reads_only_capped_body(monkeypatch):
    import httpx
    from discovery.config import LINK_BODY_MAX_BYTES

    pulled = []

    class FakeResp:
        status_code, encoding = 200, "utf-8"

        def iter_bytes(self):
            for i in range(10_000):
                pulled.append(i)
                yield b"a" * 65536                         # 끝없이 큰 본문

    class Ctx:
        def __enter__(self):
            return FakeResp()

        def __exit__(self, *a):
            return False

    seen = {}
    monkeypatch.setattr(httpx, "stream", lambda method, url, **kw: seen.update(method=method, url=url, **kw) or Ctx())
    status, text = link_check.httpx_fetch("https://x.test/", 3.0)
    assert status == 200 and len(text) == LINK_BODY_MAX_BYTES
    assert len(pulled) == LINK_BODY_MAX_BYTES // 65536    # 상한만큼 읽고 중단
    assert seen["method"] == "GET" and seen["timeout"] == 3.0 and seen["follow_redirects"] is True


# ---------- 7일 감쇠: 실제 점수 경로 ----------

def _online(measured, value=1_000_000, platform="TikTok"):
    return {"platform": platform, "metric": "조회수", "value_approx": value, "tier": 4, "since": "",
            "measured_at": measured, "source_name": "s"}


def test_measured_end_uses_last_moment_of_month_or_year():
    assert measured_end("2026-10").date().isoformat() == "2026-10-31"
    assert measured_end("2026-12").date().isoformat() == "2026-12-31"
    assert measured_end("2026").date().isoformat() == "2026-12-31"
    assert measured_end("2026-10-20").date().isoformat() == "2026-10-20"
    assert measured_end("모름") is None and measured_end("") is None


def test_is_stale_boundary_is_over_7_days():
    c = {"decay_days": 7}
    assert not is_stale("2026-10-17T12:00:00+00:00", NOW, c)       # 정확히 7일: 아직 아님
    assert is_stale("2026-10-17T11:59:00+00:00", NOW, c)
    assert not is_stale("", NOW, c) and not is_stale("2026-01-01", None, c)   # 시각을 모르거나 now가 없으면 판단 안 함
    assert not is_stale("2026-10", NOW, c)                          # 달 단위는 그 달 끝으로 본다


def test_compute_popularity_halves_stale_online_evidence():
    fresh = compute_popularity([_online("2026-10-23")], [], w=W, now=NOW)
    old = compute_popularity([_online("2026-10-01")], [], w=W, now=NOW)
    assert old.scores["online"] == pytest.approx(fresh.scores["online"] / 2, rel=0.02)
    assert "7일 초과" in old.notes["online"] and "online" not in fresh.notes
    # now를 주지 않는 직접 호출은 감쇠하지 않는다(실제 점수 경로는 항상 now를 넘김)
    assert compute_popularity([_online("2026-10-01")], [], w=W).scores["online"] == fresh.scores["online"]


def test_best_online_evidence_is_chosen_after_decay():
    a = _online("2026-10-01", 5_000_000, "A")   # 값은 크지만 오래됨 → 절반
    b = _online("2026-10-23", 50_000, "B")      # 작지만 신선
    stale_a = compute_popularity([a], [], w=W, now=NOW).scores["online"]
    fresh_b = compute_popularity([b], [], w=W, now=NOW).scores["online"]
    assert stale_a < fresh_b                    # 감쇠 전이면 A가 더 컸을 것(5e6 > 5e4)
    assert compute_popularity([a], [], w=W).scores["online"] > fresh_b
    both = compute_popularity([a, b], [], w=W, now=NOW).scores["online"]
    assert both == pytest.approx(fresh_b + 0.5, abs=0.01)   # 감쇠 후 최고(B) + 다른 플랫폼 0.5


def _game(measured):
    d = dict(name="g", url="", source="", metrics={}, notes="규칙: 탭", measured_at="",
             traits={"session_seconds": 20, "controls": ["tap"], "score_type": "single_number", "impl_ease": 5},
             online=[_online(measured)])
    return Signal.from_dict(d)


def test_decay_is_applied_in_run_pipeline_score_path():
    fresh, _ = run_pipeline([_game("2026-10-23")], lambda u, t: (200, ""), now=NOW)
    old, _ = run_pipeline([_game("2026-10-01")], lambda u, t: (200, ""), now=NOW)
    # 점수 경로(run_pipeline → compute_popularity → score_signal)에서 오래된 근거가 낮게 나온다
    assert old[0].popularity_scores["online"] < fresh[0].popularity_scores["online"]
    assert old[0].score < fresh[0].score
    assert old[0].popularity_scores["online"] == pytest.approx(fresh[0].popularity_scores["online"] / 2, rel=0.02)
    assert "7일 초과" in old[0].popularity_notes["online"]
    # 같은 근거라도 기준 시각이 7일 안이면 감쇠 없음
    near, _ = run_pipeline([_game("2026-10-01")], lambda u, t: (200, ""), now=datetime(2026, 10, 7, tzinfo=timezone.utc))
    assert near[0].popularity_scores["online"] == fresh[0].popularity_scores["online"]


def test_decay_is_applied_in_run_memes_score_path():
    def meme(measured):
        return Meme.from_dict({"name": "m", "type": "format", "summary": "s", "since": "2026-10",
                               "online": [_online(measured)]})
    fresh, _ = run_memes([meme("2026-10-23")], lambda u, t: (200, ""), W, now=NOW)
    old, _ = run_memes([meme("2026-10-01")], lambda u, t: (200, ""), W, now=NOW)
    assert old[0]["popularity_scores"]["online"] == pytest.approx(fresh[0]["popularity_scores"]["online"] / 2, rel=0.02)
    assert old[0]["score"] < fresh[0]["score"]


def test_decay_visible_through_cli_output(tmp_path):
    """같은 자료를 기준 시각만 20일 뒤로 밀면 온라인 근거가 모두 7일을 넘어 인기도가 내려간다."""
    a, b = tmp_path / "a", tmp_path / "b"
    assert cli.main(["run", "--signals", str(FX / "signals.json"), "--out", str(a), "--now", NOW.isoformat()]) == 0
    later = (NOW + timedelta(days=20)).isoformat()
    assert cli.main(["run", "--signals", str(FX / "signals.json"), "--out", str(b), "--now", later]) == 0
    pa = {c["name"]: c["popularity_total"] for c in json.loads((a / "candidates.json").read_text(encoding="utf-8"))}
    pb = {c["name"]: c["popularity_total"] for c in json.loads((b / "candidates.json").read_text(encoding="utf-8"))}
    assert pa and all(pb[n] < pa[n] for n in pb if n in pa)


# ---------- 반복 동작 밈은 tap_rush ----------

def test_repeat_motion_meme_maps_to_tap_rush_not_swipe_dodge():
    assert classify_type("같은 반복 동작을 끝없이 하는 영상") == "rhythm"
    assert classify_type("반복 작업에 지친 직장인 영상") == "obstacle"
    assert best_frame_for_meme(classify_type("반복 동작 챌린지")) == "tap_rush"
    assert fit_score("tap_rush", "rhythm") == 1.0 and fit_score("swipe_dodge", "rhythm") == 0.6
