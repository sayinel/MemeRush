"""ingest: normalize와 규칙 기반 파서."""
import json
from pathlib import Path

import pytest

from discovery import cli
from discovery.ingest import extract_amounts, normalize, parse_since, parse_text, split_items

TEXT = """서론 문장은 무시된다.

### 1. 첫 밈 (제목)
* **이름**: 첫 밈
* **밈 내용 한 줄**: 짧은 영상에서 뜬 문구 형식.
* **언제부터 퍼졌는지**: 2026년 8월 하순 시작.
* **온라인 인기도 근거**: TikTok 중심. 계정 @abc1 영상 2,560만 회 조회, @def 600만 회 (2026년 10월 기준).
* **커뮤니티 인기도 근거**: X(구 트위터)에서 게시글 3,500+ 좋아요. Reddit(r/memes) 및 TikTok 댓글란에서 인증 열풍.
* **시들해지는 신호**: 비슷한 영상이 늘어 반전이 약해짐.
* **저작권·상표 위험 요소**: 음원 사용 (대체 필요).
* **출처 이름과 주소**: KnowYourMeme (https://knowyourmeme.com/memes/first)

---

2. **둘째 밈**
* **밈 내용 한 줄**: 숫자만 외치는 유행.
* **온라인 인기도 근거**: Instagram 영상 수십만 건.
* **커뮤니티 인기도 근거**: Reddit(r/a, r/b), 에펨코리아에서 업보트 수만 건.
* **시들해지는 신호**: 특이사항 없음.
* **저작권·상표 위험 요소**: 위험 없음.

### 3. 셋째 (잘린 항목)
* **이름**: 셋째
* **밈 내용 한 줄**: 박자에 맞춰 걸
"""


def test_split_items_headers_both_styles_and_fields():
    items = split_items(TEXT)
    assert [i["title"] for i in items] == ["첫 밈 (제목)", "둘째 밈", "셋째 (잘린 항목)"]
    assert items[0]["fields"]["online"].startswith("TikTok 중심")
    assert "source" in items[0]["fields"] and "fading" in items[1]["fields"]


def test_extract_amounts():
    assert extract_amounts("영상 2,560만 회 조회, 600만 회") == [25_600_000, 6_000_000]
    assert extract_amounts("수십만 건, 1억 회 이상") == [300_000, 100_000_000]
    assert extract_amounts("3,500+ 좋아요") == [3500]
    assert extract_amounts("2026년 10월 2일 9~10월 @girl4u1 5위 3주") == []


def test_parse_since():
    assert parse_since("2026년 10월 2일 게재") == "2026-10-02"
    assert parse_since("2026년 8월 하순") == "2026-08"
    assert parse_since("2025년 말 시작") == "2025"
    assert parse_since("모름") == ""


def test_parse_meme_fields():
    a, b, c = parse_text(TEXT, "meme")
    assert a["name"] == "첫 밈" and not a["needs_review"]
    assert a["since"] == "2026-08" and a["fading"] is True and a["type"] == "format"
    tik = next(e for e in a["online"] if e["platform"] == "TikTok")
    assert tik["value_approx"] == pytest.approx(31_600_000) and tik["tier"] == 5
    assert tik["measured_at"] == "2026-10" and tik["source_name"] == "KnowYourMeme"
    assert tik["source_url"] == "https://knowyourmeme.com/memes/first"
    comm = {e["community"]: e for e in a["community"]}
    assert set(comm) >= {"X", "Reddit r/memes", "TikTok"}
    assert comm["X"]["upvotes_approx"] == 3500 and comm["X"]["independent"] is True
    assert any("음원" in r for r in a["ip_risks"])
    assert any("유형 미기재" in n for n in a["parse_notes"])
    # 둘째: 머리글 형식 2, 위험 없음, 시들해지는 신호 없음
    assert b["name"] == "둘째 밈" and b["fading"] is False and b["ip_risks"] == []
    assert b["online"][0]["platform"] == "Instagram" and b["online"][0]["value_approx"] == 300_000
    cm = {e["community"]: e for e in b["community"]}
    assert set(cm) == {"Reddit r/a", "Reddit r/b", "에펨코리아"}
    assert sum(e["upvotes_approx"] for e in cm.values()) == pytest.approx(30_000)
    # 셋째: 근거가 없어 needs_review
    assert c["needs_review"] and any("인기 근거" in r for r in c["review_reasons"])


def test_parse_game_kind_marks_missing_traits_for_review():
    txt = "### 1. 게임A\n* **이름**: 게임A\n* **규칙**: 탭해서 멈춘다\n* **조작**: 탭\n* **한 판 길이**: 15초\n" \
          "* **점수**: 숫자 하나\n* **온라인 인기도 근거**: YouTube 조회수 300만 회\n* **출처 이름과 주소**: 어딘가 (https://x.test/a)\n" \
          "### 2. 게임B\n* **이름**: 게임B\n"
    a, b = parse_text(txt, "game")
    assert a["traits"] == {"controls": ["tap"], "session_seconds": 15.0, "score_type": "single_number"}
    assert a["notes"].startswith("규칙:") and a["url"] == "https://x.test/a" and not a["needs_review"]
    assert b["needs_review"] and any("traits" in r for r in b["review_reasons"])


def test_parse_flags_safety_keyword_and_real_person():
    txt = "### 1. 위험 밈\n* **이름**: 위험 밈\n* **밈 내용 한 줄**: 특정인을 조롱하는 짤. 유명인 얼굴을 합성.\n" \
          "* **온라인 인기도 근거**: TikTok 조회수 100만 회\n"
    (m,) = parse_text(txt, "meme")
    assert m["safety_flags"] == ["조롱"] and any("실존 인물" in r for r in m["ip_risks"])


def test_normalize_legacy_and_validation():
    n = normalize({"name": "g", "url": "u", "traits": {"session_seconds": 10, "controls": ["tap"], "score_type": "single_number"},
                   "popularity_evidence": [{"platform": "P", "value": 5000, "url": "https://e.test"}]}, "game")
    assert "popularity_evidence" not in n and n["online"][0]["tier"] == 2 and not n["needs_review"]
    assert any("변환" in x for x in n["parse_notes"])
    bad = normalize({"name": "", "community": [{"community": "r/a", "sentiment": "wow", "independent": "false"}]}, "meme")
    assert bad["needs_review"] and "name 없음" in bad["review_reasons"] and "summary(밈 내용) 없음" in bad["review_reasons"]
    assert bad["community"][0]["sentiment"] == "positive" and bad["community"][0]["independent"] is False
    assert bad["type"] == "format"
    with pytest.raises(ValueError):
        normalize({"name": "x"}, "other")


def test_ingest_cli_roundtrip_and_pipeline_skips_needs_review(tmp_path):
    src = tmp_path / "r.txt"
    src.write_text(TEXT, encoding="utf-8")
    out = tmp_path / "memes.json"
    assert cli.main(["ingest", "--text", str(src), "--kind", "meme", "--out", str(out)]) == 0
    doc = json.loads(out.read_text(encoding="utf-8"))
    assert len(doc["memes"]) == 3 and sum(m["needs_review"] for m in doc["memes"]) == 1
    from discovery.memes import load_memes, run_memes
    ranked, rej = run_memes(load_memes(out), lambda u, t: (200, ""))
    assert len(ranked) == 2 and "needs_review" in rej[0]["reasons"][0]


GURU = Path(__file__).parent / "fixtures" / "guru_memes_out.txt"  # 저장소 안 시험 자료(상대 경로)


def test_real_guru_text_parses():
    assert GURU.exists()
    items = parse_text(GURU.read_text(encoding="utf-8"), "meme")
    assert len(items) >= 6
    ok = [i for i in items if not i["needs_review"]]
    assert len(ok) >= 6 and all(i["online"] and i["summary"] for i in ok)


# ---------- 리뷰 반영: 절 단위 부정 판정(안전·저작권·유행 지남·조작 의심) ----------

def _meme(**lines):
    label = {"safety": "안전", "ip": "저작권·상표 위험 요소", "fading": "시들해지는 신호", "astroturf": "인위적 바이럴 의심"}
    body = "".join(f"* **{label[k]}**: {v}\n" for k, v in lines.items())
    txt = ("### 1. 밈\n* **이름**: 밈\n* **밈 내용 한 줄**: 짧은 영상 문구.\n"
           "* **온라인 인기도 근거**: TikTok 조회수 100만 회\n" + body)
    return parse_text(txt, "meme")[0]


def test_safety_line_with_both_found_and_none_clauses_is_flagged():
    m = _meme(safety="특정인 조롱 요소 있음, 성적 암시 없음")
    assert m["safety_flags"] == ["특정인 조롱 요소 있음"]   # 없음 절은 플래그가 아님
    from discovery.memes import Meme, safety_reasons
    assert safety_reasons(Meme.from_dict(m)) and "특정인 조롱" in safety_reasons(Meme.from_dict(m))[0]


@pytest.mark.parametrize("line", ["없음", "해당 없음", "특이사항 없음.", "조롱 요소 없음, 성적 암시 없음", "혐오 없음 및 약물 없음"])
def test_safety_line_all_none_is_not_flagged(line):
    assert _meme(safety=line)["safety_flags"] == []


def test_safety_mixed_clauses_other_separators():
    assert _meme(safety="성적 암시 없음; 약물 암시 있음")["safety_flags"] == ["약물 암시 있음"]
    assert _meme(safety="혐오 없음 (다만 조롱 요소 있음)")["safety_flags"] == ["다만 조롱 요소 있음"]  # 괄호 안 판정도 절로 본다


def test_ip_risk_clauses_ignore_none_clauses():
    m = _meme(ip="음원 사용, 상표 없음")
    assert m["ip_risks"] == ["음원 사용"]
    from discovery.memes import Meme, ip_assessment
    from discovery.scoring import load_weights
    a = ip_assessment(Meme.from_dict(m), load_weights())
    assert a["categories"] == ["음원"] and a["penalty"] == 10   # "상표 없음"이 상표 감점으로 세어지지 않음
    assert _meme(ip="음원 없음, 상표 없음, 실존 인물 없음")["ip_risks"] == []
    assert _meme(ip="위험 없음")["ip_risks"] == []


def test_fading_and_astroturf_by_clause():
    assert _meme(fading="검색량 감소 있음, 광고 없음")["fading"] is True
    assert _meme(fading="특이사항 없음")["fading"] is False
    assert _meme(fading="광고 없음에도 불구하고 반응이 줄어듦")["fading"] is True   # "없음"이 들어 있어도 줄 전체가 없음이 아니다
    assert _meme(astroturf="의심 정황 있음, 광고 없음")["astroturf_suspect"] is True
    assert _meme(astroturf="의심 없음")["astroturf_suspect"] is False
    assert _meme(astroturf="조작 의심 아님, 확인되지 않음")["astroturf_suspect"] is False


# ---------- 숫자 추출 ----------

@pytest.mark.parametrize("seg,vals", [
    ("1,000개", [1000]), ("3만 개", [30_000]), ("12,345위", []), ("30%", []), ("3배", []), ("15초", []),
    ("조회 1,000개 중 30% 가 3배 늘어 15초 만에 12,345위", [1000]),
    ("2,560만 회 이상, 1.5억 회", [25_600_000, 150_000_000]),
    ("3개 플랫폼에서 2만 건", [20_000]),
    ("1,00", []), ("3, 4 회", [3, 4]),   # 3자리 묶음이 아닌 조각은 읽지 않음(잘못 읽느니 건너뜀)
])
def test_extract_amounts_units_and_exclusions(seg, vals):
    assert extract_amounts(seg) == vals


# ---------- 점수 유형 ----------

def _game(score_line):
    txt = ("### 1. 게임A\n* **이름**: 게임A\n* **규칙**: 탭해서 멈춘다\n* **조작**: 탭\n* **한 판 길이**: 15초\n"
           + (f"* **점수**: {score_line}\n" if score_line is not None else "")
           + "* **온라인 인기도 근거**: YouTube 조회수 300만 회\n* **출처 이름과 주소**: 어딘가 (https://x.test/a)\n")
    return parse_text(txt, "game")[0]


@pytest.mark.parametrize("line", ["숫자 하나", "클리어 시간", "생존 시간(초)", "횟수", "높이 기록", "점수가 숫자로 나옴"])
def test_score_line_with_number_description_passes(line):
    assert _game(line)["traits"]["score_type"] == "single_number"


@pytest.mark.parametrize("line", ["여러 지표를 합친 복합 점수", "결과는 유형 문구로 나옴", "등급(S, A, B)"])
def test_score_line_with_multiple_or_text_result_is_unclear(line):
    assert _game(line)["traits"]["score_type"] == "unclear"


def test_missing_score_line_is_left_empty_not_assumed_single_number():
    t = _game(None)["traits"]
    assert "score_type" not in t or t.get("inferred")  # 줄이 없으면 만들어 채우지 않음(추론이면 inferred 표시)


def test_repeat_motion_meme_type_is_rhythm_not_obstacle():
    txt = ("### 1. 밈\n* **이름**: 밈\n* **밈 내용 한 줄**: 짧은 영상 문구.\n* **밈 유형**: 반복 동작\n"
           "* **온라인 인기도 근거**: TikTok 조회수 100만 회\n"
           "### 2. 밈2\n* **이름**: 밈2\n* **밈 내용 한 줄**: 짧은 영상 문구.\n* **밈 유형**: 반복 노동\n"
           "* **온라인 인기도 근거**: TikTok 조회수 100만 회\n")
    a, b = parse_text(txt, "meme")
    assert a["type"] == "rhythm" and b["type"] == "obstacle"
