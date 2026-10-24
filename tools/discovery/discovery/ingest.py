"""슈퍼구루 조사 본문(자유 글) → 신호 JSON. LLM 없이 규칙 기반.

- normalize(item, kind): 입력 dict를 검사·정규화(online/community 모양, 옛 popularity_evidence 변환, 필수 확인).
- parse_text(text, kind): 항목 머리글(`### 1.` 또는 `1. **이름**`)로 나누고 한글 머리말 줄을 읽는다.
  읽지 못한 항목은 needs_review=true. 수치는 본문에서 대략 값으로만 읽고, 없으면 만들지 않는다.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .evidence import derive_tier, normalize_evidence, num, truthy
from .frames import FRAMES, guess_frame
from .infer import infer_traits
from .memes import MEME_TYPES, classify_type

KINDS = ("game", "meme")
_TYPE_KO = {"숫자": "number", "타이밍": "timing", "박자": "rhythm", "리듬": "rhythm", "춤": "rhythm",
            "피하기": "obstacle", "장애물": "obstacle", "반복": "obstacle", "노동": "obstacle",
            "형식": "format", "문구": "format"}


# ---------------- normalize ----------------

def normalize(item: dict[str, Any], kind: str) -> dict[str, Any]:
    """검사·정규화한 새 dict. 막히는 문제는 needs_review=true와 review_reasons, 사소한 것은 parse_notes."""
    if kind not in KINDS:
        raise ValueError(f"kind는 game|meme: {kind}")
    out = {k: v for k, v in item.items() if k != "popularity_evidence"}
    online, community, issues = normalize_evidence(item)
    out["online"], out["community"] = online, community
    out["fading"] = truthy(item.get("fading"))
    out["astroturf_suspect"] = truthy(item.get("astroturf_suspect"))
    reasons = list(item.get("review_reasons") or [])
    name = str(item.get("name") or "").strip()
    out["name"] = name
    if not name:
        reasons.append("name 없음")
    if kind == "meme":
        t = item.get("type")
        if t not in MEME_TYPES:
            if t is not None:
                issues.append(f"type '{t}' 알 수 없음: format으로 처리")
                t = "format"
            else:
                t = classify_type(str(item.get("summary") or ""), str(item.get("game_hint") or ""))
        out["type"] = t
        out["summary"] = str(item.get("summary") or "").strip()
        out["since"] = str(item.get("since") or "")
        out["safety_flags"] = [str(x) for x in (item.get("safety_flags") or [])]
        out["ip_risks"] = [str(x) for x in (item.get("ip_risks") or [])]
        sug = num(item.get("target_seconds_suggestion"))
        out["target_seconds_suggestion"] = sug
        if item.get("target_seconds_suggestion") is not None and sug is None:
            issues.append("target_seconds_suggestion 숫자 아님: 무시")
        if not out["summary"]:
            reasons.append("summary(밈 내용) 없음")
        if not online and not community:
            reasons.append("인기 근거(online·community) 없음")
    else:
        if not str(item.get("url") or "").strip():
            reasons.append("url 없음")
        tr = item.get("traits") or {}
        missing = [k for k in ("session_seconds", "controls", "score_type") if not tr.get(k)]
        if missing and not tr.get("inferred"):  # 추론으로 채운 항목이 있으면 사람 검토로 밀지 않고 inferred로 통과
            reasons.append("traits 부족: " + ", ".join(missing))
    out["needs_review"] = bool(reasons) or truthy(item.get("needs_review"))
    out["review_reasons"] = reasons
    notes = list(item.get("parse_notes") or []) + issues
    if notes:
        out["parse_notes"] = notes
    return out


# ---------------- 본문 나누기 ----------------

_H1 = re.compile(r"^\s{0,3}#{1,6}\s*(\d+)[.)]\s*(.+?)\s*$")
_H2 = re.compile(r"^(\d+)[.)]\s+\*\*(.+?)\*\*\s*(.*)$")
_END = re.compile(r"^\s{0,3}#{1,6}\s*(?!\d)\S*\s*(종합|총평|결론)")
_FIELD = re.compile(r"^\s*(?:[*\-•]\s+)?\*\*(.+?)\*\*\s*[:：]?\s*(.*)$")
_LABELS = [  # (머리말 시작, 키) — 앞에서부터 처음 맞는 것
    ("출처", "source"), ("이름", "name"), ("밈 내용", "summary"), ("한 줄 요약", "summary"),
    ("언제부터", "since"), ("온라인 인기도", "online"), ("커뮤니티 인기도", "community"),
    ("시들해지는", "fading"), ("인위적", "astroturf"), ("게임으로 바꾸면", "game_hint"),
    ("한 줄 규칙", "rule"), ("게임 규칙", "rule"), ("규칙", "rule"), ("저작권", "ip"), ("밈 유형", "type"), ("유형", "type"),
    ("안전", "safety"), ("퍼진 배경", "background"), ("조작", "controls"), ("한 판", "session"),
    ("점수", "score_type"), ("인기 이유", "reason"), ("반대", "counter"),
]


def _key(label: str) -> str | None:
    label = label.strip().rstrip(":：").strip()
    for start, k in _LABELS:
        if label.startswith(start):
            return k
    return None


def split_items(text: str) -> list[dict[str, Any]]:
    """[{title, fields{키: 글}, raw}] 항목 머리글 단위로 나눈다."""
    items: list[dict[str, Any]] = []
    cur: dict[str, Any] | None = None
    last: str | None = None
    for line in text.splitlines():
        if _END.match(line):  # "### 종합 검토 및 총평" 같은 맺음 절부터는 항목이 아니다
            break
        h = _H1.match(line) or _H2.match(line)
        if h:
            cur = {"title": re.sub(r"\*+", "", h.group(2)).strip(), "fields": {}, "raw": []}
            items.append(cur)
            last = None
            continue
        if cur is None:
            continue
        if line.strip() in ("---", "***", "___"):
            last = None
            continue
        cur["raw"].append(line)
        f = _FIELD.match(line)
        k = _key(f.group(1)) if f else None
        if f and k:
            body = f.group(2).strip()
            cur["fields"][k] = (cur["fields"][k] + "\n" + body) if k in cur["fields"] else body
            last = k
        elif f and not k:
            last = None  # 알 수 없는 머리말
        elif last and line.strip():
            cur["fields"][last] += "\n" + line.strip()
    return items


# ---------------- 값 읽기 ----------------

_APPROX = {"수천만": 3e7, "수백만": 3e6, "수십만": 3e5, "수억": 3e8, "수천": 3e3, "수백": 3e2, "수만": 3e4, "수십": 30.0}
_APPROX_RE = re.compile("|".join(_APPROX))
_UNIT = {"억": 1e8, "만": 1e4, "천": 1e3}
_NUM_RE = re.compile(r"(?<![\w@./:-])(\d[\d,]*(?:\.\d+)?)\s*(억|만|천)?\+?(?![\d~]|\s*[년월일위주개분])")


def extract_amounts(seg: str) -> list[float]:
    """'2,560만 회', '수십만 건', '3,500+' → 대략 숫자. 날짜·순위·핸들 속 숫자는 제외."""
    out = [_APPROX[m.group(0)] for m in _APPROX_RE.finditer(seg)]
    rest = _APPROX_RE.sub(" ", seg)
    for m in _NUM_RE.finditer(rest):
        v = float(m.group(1).replace(",", "")) * _UNIT.get(m.group(2) or "", 1.0)
        out.append(v)
    return out


def parse_since(text: str) -> str:
    m = re.search(r"(\d{4})년\s*(\d{1,2})월(?:\s*(\d{1,2})일)?", text)
    if m:
        s = f"{m.group(1)}-{int(m.group(2)):02d}"
        return s + (f"-{int(m.group(3)):02d}" if m.group(3) else "")
    m = re.search(r"(\d{4})년", text)
    return m.group(1) if m else ""


_PLATFORMS = [
    ("TikTok", r"tik\s?tok|틱톡"), ("Instagram", r"instagram|인스타|reels|릴스"),
    ("YouTube", r"youtube|유튜브|shorts|쇼츠"), ("X", r"(?<![A-Za-z0-9])X(?![A-Za-z0-9])|트위터"),
    ("Reddit", r"reddit|레딧"), ("Naver", r"naver|네이버"), ("Google", r"google(?! play)|구글(?! 플레이)"),
    # 게임 조사 자료의 플랫폼(스토어·웹 게임 포털·방송)
    ("Poki", r"poki"), ("CrazyGames", r"crazygames"), ("itch.io", r"itch\.io"),
    ("Google Play", r"google play|구글 플레이|플레이 스토어"), ("App Store", r"app store|앱스토어"),
    ("Twitch", r"twitch|트위치"),
]
_COMMUNITY_NAMED = [("Discord", r"디스코드|discord"), ("에펨코리아", r"에펨코리아"), ("디시인사이드", r"디시인사이드"),
                    ("더쿠", r"더쿠"), ("루리웹", r"루리웹"), ("클리앙", r"클리앙")]
_GENERIC_COMM = re.compile(r"((?:[가-힣·]+\s){0,1}[가-힣·]+\s?(?:커뮤니티|게시판))")


def _find(patterns: list[tuple[str, str]], seg: str) -> list[tuple[int, str]]:
    hits = []
    for name, pat in patterns:
        m = re.search(pat, seg, re.I if name != "X" else 0)
        if m:
            hits.append((m.start(), name))
    return hits


def find_platforms(seg: str) -> list[str]:
    return [n for _, n in sorted(_find(_PLATFORMS, seg))]


def find_communities(seg: str) -> list[str]:
    hits = [(m.start(), f"Reddit {m.group(0)}") for m in re.finditer(r"r/\w+", seg)]
    plat = _find(_PLATFORMS, seg)
    if not hits:
        hits += [(p, n) for p, n in plat if n == "Reddit"]
    hits += [(p, n) for p, n in plat if n != "Reddit"]
    hits += _find(_COMMUNITY_NAMED, seg)
    for m in _GENERIC_COMM.finditer(seg):
        label = m.group(1).replace("  ", " ").strip()
        if not any(label in n or n in label for _, n in hits):
            hits.append((m.start(), label))
    seen, out = set(), []
    for _, n in sorted(hits):
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out


def _metric(seg: str) -> str | None:
    for kw, name in (("조회", "조회수"), ("좋아요", "좋아요"), ("업보트", "업보트"), ("영상", "영상 수")):
        if kw in seg:
            return name
    return None


def parse_online(text: str, since: str, src_name: str, src_url: str) -> list[dict[str, Any]]:
    mt = re.search(r"(\d{4})년\s*(\d{1,2})월\s*기준", text)
    measured = f"{mt.group(1)}-{int(mt.group(2)):02d}" if mt else ""
    plats: list[str] = []
    metric = "조회수"
    acc: dict[tuple[str, str], float] = {}
    for sentence in [s for s in re.split(r"(?<=[.!?])\s+|\n", text) if s.strip()]:
        pending: list[str] = []  # 수치 없이 플랫폼만 나열된 앞 조각(예: "TikTok, Instagram Reels ...")
        for seg in [s for s in re.split(r"[,，]\s+|;", sentence) if s.strip()]:
            found = find_platforms(seg)
            amounts = extract_amounts(seg)
            if found and not amounts:
                pending += [p for p in found if p not in pending]
                plats = list(pending)
            elif found:
                plats, pending = found, []
            mm = _metric(seg)
            if mm:
                metric = mm
            if not amounts or not plats:
                continue
            share = sum(amounts) / len(plats)
            for p in plats:
                acc[(p, metric)] = acc.get((p, metric), 0.0) + share
    out = []
    for (p, m), v in acc.items():
        e: dict[str, Any] = {"platform": p, "metric": m, "value_approx": v, "tier": derive_tier(v),
                             "since": since, "measured_at": measured, "source_name": src_name}
        if src_url:
            e["source_url"] = src_url
        out.append(e)
    return out


def parse_community(text: str, src_name: str, src_url: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for seg in [s for s in re.split(r"(?<=[.!?])\s+|\n", text) if s.strip()]:
        names = find_communities(seg)
        if not names:
            continue
        amounts = extract_amounts(seg)
        share = sum(amounts) / len(names) if amounts else 0.0
        votes = bool(re.search(r"업보트|좋아요|추천|upvote", seg, re.I))
        mixed = bool(re.search(r"논란|비판|반발|비난|부정", seg))
        for n in names:
            e: dict[str, Any] = {"community": n, "mentions": 0 if votes else share,
                                 "upvotes_approx": share if votes else 0,
                                 "sentiment": "mixed" if mixed else "positive",
                                 "independent": True, "source_name": src_name}
            if src_url:
                e["source_url"] = src_url
            out.append(e)
    merged: dict[str, dict[str, Any]] = {}
    for e in out:  # 같은 커뮤니티가 여러 문장에 나오면 합산
        m = merged.setdefault(e["community"], {**e, "mentions": 0, "upvotes_approx": 0})
        m["mentions"] += e["mentions"]
        m["upvotes_approx"] += e["upvotes_approx"]
    return list(merged.values())


_SAFETY_KW = ("조롱", "혐오", "마약", "약물", "성적", "선정적")
_REAL_PERSON_KW = ("딥페이크", "유명인", "실존 인물", "얼굴을 합성", "얼굴 합성")


def _source(text: str) -> tuple[str, str]:
    url = re.search(r"https?://[^\s)\]]+", text or "")
    name = re.split(r"[(（]", text or "", maxsplit=1)[0].strip()
    return name, (url.group(0) if url else "")


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"\*+", "", s or "")).strip()


def parse_item(block: dict[str, Any], kind: str) -> dict[str, Any]:
    f = {k: _clean(v) if k not in ("source",) else v for k, v in block["fields"].items()}
    notes: list[str] = []
    name = f.get("name") or block["title"]
    src_name, src_url = _source(f.get("source", ""))
    since = parse_since(f.get("since", ""))
    item: dict[str, Any] = {"name": name, "fading": False, "astroturf_suspect": False}
    online = parse_online(f["online"], since, src_name, src_url) if f.get("online") else []
    community = parse_community(f["community"], src_name, src_url) if f.get("community") else []
    item["online"], item["community"] = online, community
    if f.get("online") and not online:
        notes.append("온라인 인기도 근거 줄은 있으나 플랫폼·수치를 읽지 못함")
    if f.get("community") and not community:
        notes.append("커뮤니티 인기도 근거 줄은 있으나 커뮤니티를 읽지 못함")
    if f.get("fading"):
        item["fading"] = not re.search(r"없음|없다|특이\s*사항\s*없", f["fading"])
        item["fading_note"] = f["fading"]
    if f.get("astroturf"):
        item["astroturf_suspect"] = bool(re.search(r"의심|있음|확인", f["astroturf"])) and not re.search(r"없음|아님", f["astroturf"])
    body = " ".join(v for k, v in f.items() if k in ("summary", "background", "community", "name"))
    if kind == "meme":
        item["summary"] = f.get("summary", "")
        item["since"] = since
        t = f.get("type", "")
        item["type"] = next((v for k, v in _TYPE_KO.items() if k in t), t if t in MEME_TYPES else "")
        if not item["type"]:
            item["type"] = classify_type(f.get("summary", ""), f.get("game_hint", ""))
            item["type_inferred"] = True
            notes.append(f"밈 유형 미기재: 본문 단어로 {item['type']} 추정(추론값, 사람 확인 필요)")
        ip = f.get("ip", "")
        risks = [] if (ip and re.search(r"위험\s*없음|없음", ip) and not re.search(r"음원|상표|로고", ip)) else ([ip] if ip else [])
        if any(k in body for k in _REAL_PERSON_KW):
            risks.append("실존 인물: 유명인 얼굴 합성 언급(본문 감지)")
            notes.append("본문에서 실존 인물 사용 감지: ip_risks 추가")
        item["ip_risks"] = risks
        flags = [k for k in _SAFETY_KW if k in body]
        if f.get("safety") and not re.search(r"없음", f["safety"]):
            flags.append(f["safety"])
        if flags:
            notes.append(f"본문에서 안전 키워드 감지: {', '.join(flags)} → 안전 플래그로 기록(탈락 처리, 사람이 확인)")
        item["safety_flags"] = flags
        if f.get("game_hint"):
            item["game_hint"] = f["game_hint"]
        sec = re.search(r"(\d+(?:\.\d+)?)\s*초", f.get("summary", ""))
        if item.get("type") in ("number", "timing") and sec:
            item["target_seconds_suggestion"] = float(sec.group(1))
    else:
        if f.get("rule"):
            item["notes"] = "규칙: " + f["rule"]
        elif f.get("game_hint"):
            item["notes"] = "규칙: " + f["game_hint"]
        item["url"] = src_url
        item["source"] = src_name
        traits: dict[str, Any] = {}
        if f.get("controls"):
            c = [n for n, kw in (("tap", r"탭|tap"), ("swipe", r"스와이프|swipe"), ("keyboard", r"키보드|keyboard"))
                 if re.search(kw, f["controls"], re.I)]
            if c:
                traits["controls"] = c
        m = re.search(r"(\d+(?:\.\d+)?)\s*초", f.get("session", ""))
        if m:
            traits["session_seconds"] = float(m.group(1))
        if f.get("score_type"):
            traits["score_type"] = "single_number" if re.search(r"숫자\s*(하나|한 개|1개)|single", f["score_type"], re.I) else "unclear"
        rule_txt = f.get("rule") or f.get("game_hint") or ""
        reason_txt = f.get("reason", "")
        frame, kws = guess_frame(rule_txt)
        if frame is None:
            frame, kws = guess_frame(reason_txt)
        item["frame_guess"] = frame
        if frame:
            item["frame_reason"] = f"규칙어 {', '.join(kws)}"
        got = infer_traits(rule_txt, reason_txt, f.get("community", ""), traits)
        absent = [k for k in ("session_seconds", "controls", "score_type") if not traits.get(k) and k not in got]
        if got or (frame and absent):
            traits.update(got)
            traits["inferred"] = True
            traits["inferred_fields"] = sorted(got)
            if absent:  # 글에서 못 읽은 항목은 틀의 기본값을 쓴다(만들지 않고 비워 둠)
                traits["frame_default_fields"] = absent
            notes.append("traits 추론값(낮은 신뢰): " + (", ".join(sorted(got)) or "없음")
                         + (f" / 비어 있어 틀 기본값 사용: {', '.join(absent)}" if absent else ""))
        if traits:
            item["traits"] = traits
        if f.get("summary"):
            item["meme_context"] = {"summary": f["summary"], "since": since}
    reasons = []
    if not f.get("name") and not block["title"]:
        reasons.append("이름을 읽지 못함")
    if notes:
        item["parse_notes"] = notes
    item["review_reasons"] = reasons
    item["_source_title"] = block["title"]
    return normalize(item, kind)


def parse_text(text: str, kind: str) -> list[dict[str, Any]]:
    if kind not in KINDS:
        raise ValueError(f"kind는 game|meme: {kind}")
    return [parse_item(b, kind) for b in split_items(text)]


def ingest_file(text_path: str | Path, kind: str, out_path: str | Path) -> dict[str, Any]:
    text = Path(text_path).read_text(encoding="utf-8")
    items = parse_text(text, kind)
    key = "memes" if kind == "meme" else "signals"
    doc = {"_note": "ingest가 조사 본문에서 규칙 기반으로 만든 초안. needs_review 항목은 사람이 확인 전에는 후보에서 제외됨",
           key: items}
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Path(out_path).write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    review = [i["name"] for i in items if i["needs_review"]]
    return {"items": len(items), "ok": len(items) - len(review), "needs_review": len(review), "review_names": review}
