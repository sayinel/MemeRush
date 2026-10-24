"""인기도(온라인·커뮤니티·합의도·감점) 시험. 링크 열림은 점수와 무관함을 확인."""
import json
from pathlib import Path

import pytest

from discovery.evidence import derive_tier
from discovery.models import Signal
from discovery.pipeline import make_sim_fetch, render_markdown, run_pipeline
from discovery.popularity import background_line, compute_popularity, score_community, score_online, _cfg
from discovery.scoring import load_weights
from discovery.sources.file_source import FileSource
from datetime import datetime, timezone

FX = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
W = load_weights()
C = _cfg(W)


def on(platform="TikTok", value=1_000_000, tier=4, **kw):
    d = dict(platform=platform, metric="조회수", value_approx=value, tier=tier, since="", measured_at="")
    d.update(kw)
    return d


def co(name="Reddit r/a", mentions=1000, up=10000, sentiment="positive", independent=True, **kw):
    d = dict(community=name, mentions=mentions, upvotes_approx=up, sentiment=sentiment, independent=independent)
    d.update(kw)
    return d


def pop(online=(), community=(), fading=False, astro=False):
    return compute_popularity(list(online), list(community), fading, astro, W)


def test_tier_derivation():
    assert [derive_tier(v) for v in (0, 999, 1000, 99999, 100000, 10**6, 10**9)] == [1, 1, 2, 3, 4, 5, 5]


def test_online_score_rises_with_tier_and_value():
    lo = score_online([on(value=2000, tier=2)], C)[0]
    hi = score_online([on(value=10**8, tier=5)], C)[0]
    assert 0 < lo < hi <= 10
    assert score_online([], C)[0] == 0


def test_online_velocity_weight():
    slow = score_online([on(value=10**6, since="2000-01-01", measured_at="2026-10-01")], C)[0]
    fast = score_online([on(value=10**6, since="2026-09-30", measured_at="2026-10-01")], C)[0]
    unknown = score_online([on(value=10**6)], C)[0]
    assert slow < unknown < fast


def test_online_extra_platforms_add_small_bonus():
    one = score_online([on("A")], C)[0]
    two = score_online([on("A"), on("B")], C)[0]
    assert 0 < two - one <= 1.5


def test_community_independent_count_and_scale():
    one = score_community([co("r/a")], C)[0]
    three = score_community([co("r/a"), co("r/b"), co("r/c")], C)[0]
    assert three > one > 0
    # 같은 이름 반복은 독립 커뮤니티 1개로 침
    same = score_community([co("r/a"), co("r/a")], C)[0]
    assert same < three


def test_community_non_independent_not_counted():
    ind = score_community([co("r/a"), co("r/b")], C)[0]
    rep = score_community([co("r/a"), co("r/b", independent=False)], C)[0]
    assert rep < ind
    only_rep = score_community([co("r/a", independent=False)], C)
    assert only_rep[0] == 0 and "독립" in only_rep[1]


def test_community_counter_view_and_negative_reduce():
    base = score_community([co("r/a"), co("r/b")], C)[0]
    neg = score_community([co("r/a"), co("r/b", sentiment="negative", counter_view="끝물")], C)[0]
    mixed = score_community([co("r/a"), co("r/b", sentiment="mixed")], C)[0]
    assert neg < mixed < base


def test_consensus_single_source_penalty_x07():
    one = pop([on("A")], [])
    assert one.consensus["single_source"] and one.consensus["label"] == "단일 출처"
    assert one.consensus["factor"] == 0.7
    raw = one.scores["online"] * 5
    assert one.total == pytest.approx(raw * 0.7, abs=0.01)
    assert "단일 출처" in one.notes["consensus"]


def test_consensus_factors_by_independent_sources():
    two = pop([on("A")], [co("r/a")])
    three = pop([on("A"), on("B")], [co("r/a")])
    assert (two.consensus["independent_sources"], two.consensus["factor"]) == (2, 0.9)
    assert (three.consensus["independent_sources"], three.consensus["factor"]) == (3, 1.0)
    assert not two.consensus["single_source"] and "합의" in three.consensus["label"]
    # 재인용 커뮤니티는 독립 출처로 안 센다
    assert pop([on("A")], [co("r/a", independent=False)]).consensus["independent_sources"] == 1


def test_consensus_split_when_opinions_differ():
    c = pop([on("A")], [co("r/a"), co("r/b", sentiment="negative")]).consensus
    assert c["split"] and "엇갈림" in c["label"]
    assert not pop([on("A")], [co("r/a"), co("r/b")]).consensus["split"]


def test_fading_penalty():
    ev = ([on("A"), on("B")], [co("r/a")])
    base, fade = pop(*ev), pop(*ev, fading=True)
    assert fade.total == pytest.approx(base.total - 10) and fade.scores["fading_penalty"] == 10


def test_astroturf_penalty():
    ev = ([on("A"), on("B")], [co("r/a")])
    base, sus = pop(*ev), pop(*ev, astro=True)
    assert sus.total == pytest.approx(base.total - 15) and sus.scores["astroturf_penalty"] == 15


def test_total_clamped_0_100_and_empty_is_zero():
    assert pop([], []).total == 0
    assert pop([on("A", tier=1, value=1)], [], fading=True, astro=True).total == 0
    big = pop([on(p, 10**9, 5) for p in "ABC"], [co(n, 10**6, 10**7) for n in ("r/a", "r/b", "r/c")])
    assert big.total == pytest.approx(100)


def test_scores_keys():
    assert set(pop([on()], [co()]).scores) == {"online", "community", "consensus_factor",
                                               "fading_penalty", "astroturf_penalty", "total"}


def test_background_line_rule_based():
    p = pop([on("A"), on("B")], [co("r/a")])
    line = background_line({"summary": "10초 도전 영상 유행."}, p.scores, p.consensus)
    assert line.startswith("10초 도전 영상 유행. 온라인 ") and "커뮤니티" in line and "합의" in line
    assert "밈 정보 없음" in background_line({}, p.scores)
    assert "근거 없음" in background_line({"summary": "x"}, pop([], []).scores)


# ---- 하위 호환 ----

def test_legacy_popularity_evidence_converted_to_online():
    s = Signal.from_dict({"name": "n", "url": "u", "popularity_evidence": [
        {"platform": "Reddit r/WebGames", "rank": 2, "metric": "업보트", "value": 4800, "growth": 3000,
         "measured_at": "2026-10-23T18:00:00+00:00", "url": "https://e.test/a"}]})
    assert s.community == [] and len(s.online) == 1
    e = s.online[0]
    assert (e["platform"], e["value_approx"], e["tier"]) == ("Reddit r/WebGames", 4800, 2)
    assert e["source_url"] == "https://e.test/a" and e["source_name"] == "Reddit r/WebGames"
    assert any("online으로 변환" in x for x in s.issues)
    assert pop(s.online, s.community).total > 0


def test_missing_fields_default_safely():
    s = Signal.from_dict({"name": "n"})
    assert (s.online, s.community, s.fading, s.astroturf_suspect) == ([], [], False, False)
    s2 = Signal.from_dict({"name": "n", "community": [{"community": "r/a"}, {"mentions": 3}],
                           "online": [{"platform": "A", "value_approx": 5000}]})
    assert len(s2.community) == 1 and s2.community[0]["independent"] is True
    assert s2.community[0]["sentiment"] == "positive" and s2.online[0]["tier"] == 2


# ---- 링크 열림은 점수와 탈락에 무관 ----

def _fx():
    sigs = FileSource(FX / "signals.json").collect()
    return sigs, run_pipeline(sigs, make_sim_fetch(sigs), now=NOW)


def test_broken_links_do_not_change_score_or_reject():
    sigs, (cands, rej) = _fx()
    by = {c.name: c for c in cands}
    assert by["게이지 낚시"].link_status == "열리지 않음"            # 404인데도 후보에 있음
    assert by["게이지 낚시"].link_info["evidence"][0]["link_status"] == "열리지 않음"
    # 모든 링크를 열리게 바꿔도 점수는 같다
    ok = lambda url, t: (200, " ".join(s.name for s in sigs))
    cands2, _ = run_pipeline(sigs, ok, now=NOW)
    assert {c.name: c.score for c in cands2} == {c.name: c.score for c in cands}
    assert {c.name: c.popularity_total for c in cands2} == {c.name: c.popularity_total for c in cands}
    # 아무것도 열리지 않아도(모두 예외) 같은 후보
    def dead(url, t):
        raise TimeoutError(url)
    cands3, rej3 = run_pipeline(sigs, dead, now=NOW)
    assert [c.name for c in cands3] == [c.name for c in cands]
    assert not any("링크" in " ".join(r["reasons"]) for r in rej3)


def test_game_with_dead_link_and_evidence_passes_even_ranked_out_marked_by_score_only():
    sigs, (cands, rej) = _fx()
    marble = next(s for s in sigs if s.name == "구슬 굴리기")
    assert marble.sim["status"] == 404
    got = [c.name for c in cands] + [r["name"] for r in rej if "상위" in " ".join(r["reasons"])]
    assert "구슬 굴리기" in got
    assert not any(r["name"] == "구슬 굴리기" and "링크" in " ".join(r["reasons"]) for r in rej)


# ---- 시험 자료: 단일 출처·식는 신호·카드 표시 ----

def test_fixture_single_source_and_fading_are_lower():
    sigs, (cands, rej) = _fx()
    by = {c.name: c for c in cands}
    one = by["게이지 낚시"]
    assert one.consensus["single_source"] and one.popularity_scores["consensus_factor"] == 0.7
    assert by["스톱워치 타이머 정지"].consensus["independent_sources"] >= 3
    fading = next(s for s in sigs if s.name == "숫자 합 맞추기")
    assert fading.fading is True and len(fading.online) == 2     # 옛 모양이 online으로 변환됨


def test_card_markdown_shows_all_popularity_parts():
    _, (cands, _) = _fx()
    md = render_markdown(cands)
    cards = md.split("\n## ")[1:]
    assert len(cards) == 5
    for card in cards:
        for part in ("### 온라인 인기도", "| 플랫폼 | 지표 | 대략 값 | 영향 규모(1~5) |", "### 커뮤니티 인기도",
                     "| 커뮤니티 | 언급 | 업보트 | 분위기 | 독립 여부 | 반대 의견 |", "### 합의도",
                     "### 식는 신호", "### 인기도 점수", "인기도 총점", "/100", "### 배경", "샘플 자료"):
            assert part in card or part in md, part
        assert "░" in card and "/10" in card
    assert "⚠ 단일 출처" in md and "시들해지는 신호: **있음**" not in md   # 식는 신호 게임은 5위 밖
    assert "정보 표시용" in md
    assert md.startswith("# 오늘의 게임 후보") and "샘플 자료" in md.split("\n## ")[0]
    assert "반대 의견" in md and "쉽게 따라 그려서" in md


def test_candidates_json_has_new_fields(tmp_path):
    from discovery import cli
    out = tmp_path / "o"
    assert cli.main(["run", "--signals", str(FX / "signals.json"), "--out", str(out), "--now", NOW.isoformat()]) == 0
    data = json.loads((out / "candidates.json").read_text(encoding="utf-8"))
    for d in data:
        assert set(d["popularity_scores"]) == {"online", "community", "consensus_factor",
                                               "fading_penalty", "astroturf_penalty", "total"}
        assert d["popularity_total"] == d["popularity_scores"]["total"]
        assert d["background_line"] and "sim" not in json.dumps(d["online"] + d["community"])
        assert "note" in d["link_info"] and d["sample"] is True
