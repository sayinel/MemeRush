"""밈 후보: 읽기, 안전·저작권 규칙, 유형별 목표 시간 변환, 인기도 점수, 순위.

설계 정본: MEME_GAME_DESIGN.md 3절(유형별 변환), 4절(meme_context), 5절(안전·저작권).
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from datetime import datetime, timezone

from .config import (DEFAULT_ROUND_TARGET_S, NUMBER_MEME_MAX_S, ROUND_TARGET_RANGE_S, ROUNDS,
                     expected_session_s, round_targets_s, session_in_range)
from .evidence import is_sample, normalize_evidence, num, truthy
from .link_check import Fetch, check_link
from .popularity import compute_popularity, background_line, verify_links
from .scoring import load_weights

import re

# 유형 순서는 pairing의 "한 칸 떨어짐" 거리 계산에도 쓴다.
MEME_TYPES = ("number", "timing", "rhythm", "obstacle", "format")
TARGET_TYPES = ("number", "timing", "format")  # 목표 시간으로 바꾸는 유형. rhythm/obstacle은 틀 파라미터 제안
MIN_SEC = float(ROUND_TARGET_RANGE_S[0])  # 라운드당 목표 시간 하한
MAX_SEC = float(ROUND_TARGET_RANGE_S[1])  # 상한(숫자 밈은 NUMBER_MEME_MAX_S까지)
DEFAULT_SEC = float(DEFAULT_ROUND_TARGET_S)

_TYPE_WORDS = {
    "number": r"숫자|\d+(?:\.\d+)?\s*초",
    "timing": r"타이밍|멈추|멈춘|순간|기다렸|카운트다운|정각|스톱워치",
    "rhythm": r"박자|춤|댄스|바운스|리듬|비트|안무|스텝|들썩|반복\s*동작",  # 규격 5절: 반복 동작 밈은 tap_rush
    "obstacle": r"피하|피해|장애물|노동|알바|출근|월요일|반복\s*작업|퇴근",
}


def classify_type(summary: str, hint: str = "") -> str:
    """밈 글로 유형을 추정. 밈 내용(summary)을 먼저 보고, 단어가 없으면 게임화 힌트를 본다. 못 정하면 format.
    같은 글에서 여러 유형이 맞으면 단어 수가 많은 쪽, 동률이면 number > timing > rhythm > obstacle."""
    for text in (summary, hint):
        scores = {t: len(re.findall(p, text or "")) for t, p in _TYPE_WORDS.items()}
        best = max(scores.values())
        if best:
            return next(t for t in _TYPE_WORDS if scores[t] == best)
    return "format"


def frame_params_hint(mtype: str, text: str) -> dict[str, Any]:
    """rhythm=bpm, obstacle=speed 제안(목표 시간 대신). 그 밖의 유형은 빈 dict."""
    if mtype == "rhythm":
        m = re.search(r"(\d{2,3})\s*bpm", text or "", re.I)
        if m:
            bpm = int(m.group(1))
        elif re.search(r"칼박자|빠른|폭발|신나는", text or ""):
            bpm = 140
        elif re.search(r"느린|슬로", text or ""):
            bpm = 90
        else:
            bpm = 120
        return {"bpm": max(60, min(180, bpm))}
    if mtype == "obstacle":
        return {"speed": 5 if re.search(r"순식간|초고속|극한|빠르|스피드|속도", text or "") else 3}
    return {}

SAFETY_CATEGORIES = {
    "특정인 조롱": ("조롱", "mock", "ridicule", "harass", "bully"),
    "혐오": ("혐오", "hate", "slur", "racis", "차별"),
    "약물": ("약물", "마약", "drug"),
    "성적 암시": ("성적", "sexual", "nsfw", "19금", "선정"),
}
IP_CATEGORIES = {
    "음원": ("음원", "음악", "노래", "music", "audio", "song"),
    "상표": ("상표", "로고", "trademark", "logo", "brand"),
    "실존 인물": ("실존", "인물", "유명인", "배우", "person", "celebrity"),
}
USE_MODE_LIMITED = "형식·문구·숫자·순간만 가져오기 (음원·상표·실존 인물·영상 원본은 쓰지 않음)"
USE_MODE_FREE = "형식·문구·숫자·순간 사용(그림은 새로 그림)"


@dataclass
class Meme:
    name: str
    type: str = "format"
    summary: str = ""
    since: str = ""
    url: str = ""
    online: list[dict[str, Any]] = field(default_factory=list)
    community: list[dict[str, Any]] = field(default_factory=list)
    fading: bool = False
    astroturf_suspect: bool = False
    safety_flags: list[str] = field(default_factory=list)
    ip_risks: list[str] = field(default_factory=list)
    target_seconds_suggestion: float | None = None
    sample: bool = False
    needs_review: bool = False
    review_reasons: list[str] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)
    game_hint: str = ""
    # CONTENT_PRODUCTION_LINE 2절: 유래·맥락과 사람들 반응(상세 요약 + 출처). 스토리 브리프의 재료
    background: dict[str, Any] = field(default_factory=dict)
    reactions: list[dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: dict[str, Any], sample: bool = False) -> "Meme":
        online, community, issues = normalize_evidence(d)
        t = d.get("type")
        hint = str(d.get("game_hint") or "")
        if t is None:
            t = classify_type(str(d.get("summary") or ""), hint)
        elif t not in MEME_TYPES:
            issues.append(f"type '{t}' 알 수 없음: format으로 처리")
            t = "format"
        return cls(game_hint=hint,
            name=d["name"], type=t, summary=str(d.get("summary") or ""), since=str(d.get("since") or ""),
            url=str(d.get("url") or ""), online=online, community=community,
            fading=truthy(d.get("fading")), astroturf_suspect=truthy(d.get("astroturf_suspect")),
            safety_flags=[str(x) for x in (d.get("safety_flags") or [])],
            ip_risks=[str(x) for x in (d.get("ip_risks") or [])],
            target_seconds_suggestion=num(d.get("target_seconds_suggestion")),
            sample=sample or is_sample(d.get("_note")),
            needs_review=truthy(d.get("needs_review")), review_reasons=list(d.get("review_reasons") or []),
            issues=issues,
            background=dict(d.get("background") or {}),
            reactions=[dict(r) for r in (d.get("reactions") or []) if isinstance(r, dict)])


def load_memes(path: str | Path) -> list[Meme]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    items = data.get("memes", []) if isinstance(data, dict) else data
    sample = isinstance(data, dict) and is_sample(data.get("_note"))
    return [Meme.from_dict(d, sample=sample) for d in items]


def _fmt(sec: float) -> str:
    return f"{sec:.2f}"


def convert_target(mtype: str, suggestion: float | None) -> dict[str, Any]:
    """설계 3절: number=숫자를 초로(7초까지), timing=그 순간까지의 길이(5초까지), format=기본값.
    라운드당 3~5초(숫자 밈 7초)로 맞추고 이유를 남긴다. `default`가 True면 밈이 정한 값이 아니라
    대표값이므로 하루 판은 첫날 3·4·5초 계단을 쓴다."""
    if mtype in ("rhythm", "obstacle"):
        what = "bpm" if mtype == "rhythm" else "speed"
        return {"seconds": None, "ms": None, "clamped": False, "default": False,
                "reason": f"{'박자·춤·반복 동작' if mtype == 'rhythm' else '피하기·반복 노동'} 밈이라 목표 시간 대신 틀 파라미터({what})로 제안"}
    if mtype == "format":
        return {"seconds": DEFAULT_SEC, "ms": int(DEFAULT_SEC * 1000), "clamped": False, "default": True,
                "reason": f"형식·문구 밈이라 기본 {_fmt(DEFAULT_SEC)}초(문구만 사용), 하루 판은 첫날 3·4·5초 계단"}
    label = "숫자 자체가 웃음 포인트라 그 숫자를 초로 바꿈" if mtype == "number" else \
        "기다렸다 터지는 순간까지의 길이를 목표로 함"
    if suggestion is None:
        return {"seconds": DEFAULT_SEC, "ms": int(DEFAULT_SEC * 1000), "clamped": False, "default": True,
                "reason": f"{label}: 제안 값이 없어 기본 {_fmt(DEFAULT_SEC)}초(하루 판은 첫날 3·4·5초 계단)"}
    hi = float(NUMBER_MEME_MAX_S) if mtype == "number" else MAX_SEC
    sec, reason, clamped = suggestion, f"{label}({_fmt(suggestion)}초)", False
    if sec < MIN_SEC or sec > hi:
        near = MIN_SEC if sec < MIN_SEC else hi
        reason += (f", 라운드당 {MIN_SEC:g}~{hi:g}초 범위 밖이라 가장 가까운 {_fmt(near)}초로 맞춤")
        sec, clamped = near, True
    return {"seconds": sec, "ms": int(round(sec * 1000)), "clamped": clamped, "default": False, "reason": reason}


def safety_reasons(m: Meme) -> list[str]:
    out = []
    for f in m.safety_flags:
        if not f.strip():
            continue
        cat = next((c for c, kws in SAFETY_CATEGORIES.items() if any(k in f.lower() for k in kws)), "기타 안전 플래그")
        out.append(f"안전 규칙 위반({cat}): {f}")
    return out


def ip_assessment(m: Meme, w: dict[str, Any]) -> dict[str, Any]:
    cats, other = [], 0
    for r in m.ip_risks:
        hit = [c for c, kws in IP_CATEGORIES.items() if any(k in r.lower() for k in kws)]
        for c in hit:
            if c not in cats:
                cats.append(c)
        if not hit and r.strip():
            other += 1
    each, cap = w.get("meme_ip_penalty_each", 10), w.get("meme_ip_penalty_cap", 30)
    penalty = min(cap, each * len(cats) + (each / 2) * other)
    return {"categories": cats, "penalty": float(penalty),
            "use_mode": USE_MODE_LIMITED if cats else USE_MODE_FREE}


def meme_context(m: Meme) -> dict[str, Any]:
    """설계 4절 meme_context 모양: summary, since, url(선택)."""
    url = m.url or next((e["source_url"] for e in m.online + m.community if e.get("source_url")), "")
    ctx: dict[str, Any] = {"summary": m.summary, "since": m.since}
    if url:
        ctx["url"] = url
    return ctx


def _public(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{k: v for k, v in e.items() if k not in ("sim", "url", "link_status")} for e in items]


def run_memes(memes: list[Meme], fetch: Fetch, weights: dict[str, Any] | None = None,
              top_n: int = 5, now: datetime | None = None) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    w = weights or load_weights()
    now = now or datetime.now(timezone.utc)  # 7일 넘은 온라인 근거는 절반만 반영
    kept: list[tuple[float, Meme, dict, dict, Any, list]] = []
    rejected: list[dict[str, Any]] = []
    for m in memes:
        reasons: list[str] = []
        if m.needs_review:
            reasons.append("사람 검토 필요(needs_review): " + "; ".join(m.review_reasons or ["사유 미기재"]))
        reasons += safety_reasons(m)
        if reasons:
            rejected.append({"name": m.name, "kind": "meme", "reasons": reasons})
            continue
        pop = compute_popularity(m.online, m.community, m.fading, m.astroturf_suspect, w, now)
        ip = ip_assessment(m, w)
        score = round(max(0.0, pop.total - ip["penalty"]), 2)
        kept.append((score, m, ip, convert_target(m.type, m.target_seconds_suggestion), pop,
                     verify_links(m.online, m.community, m.name, fetch)))
    kept.sort(key=lambda x: (-x[0], x[1].name))
    ranked = []
    for i, (score, m, ip, tgt, pop, links) in enumerate(kept[:top_n], 1):
        ctx = meme_context(m)
        fph = frame_params_hint(m.type, f"{m.summary} {m.game_hint}")
        card_hint = {"type": m.type, "targetMs": tgt["ms"], "targetReason": tgt["reason"]}
        if tgt["seconds"] is not None:
            targets = round_targets_s(ROUNDS, None if tgt["default"] else tgt["seconds"])
            est = expected_session_s(targets)
            card_hint.update({"rounds": ROUNDS, "roundTargetsMs": [int(round(t * 1000)) for t in targets],
                              "expectedSessionS": round(est, 2), "sessionInRange": session_in_range(est)})
        if fph:
            card_hint["frameParamsHint"] = fph
        ranked.append({
            "rank": i, "name": m.name, "type": m.type, "score": score,
            "popularity_total": pop.total, "popularity_scores": pop.scores, "popularity_notes": pop.notes,
            "consensus": pop.consensus, "online": _public(m.online), "community": _public(m.community),
            "fading": m.fading, "astroturf_suspect": m.astroturf_suspect,
            "ip_risks": m.ip_risks, "ip_categories": ip["categories"], "ip_penalty": ip["penalty"],
            "use_mode": ip["use_mode"],
            "target_seconds": tgt["seconds"], "target_clamped": tgt["clamped"],
            "meme_context": ctx,
            "meme_card_hint": card_hint, "frame_params_hint": fph,
            "link_info": {"items": links, "note": "정보 표시용. 점수·탈락에 쓰지 않음"},
            "background_line": background_line(ctx, pop.scores, pop.consensus),
            "background": m.background, "reactions": m.reactions,
            "sample": m.sample,
        })
    for score, m, *_ in kept[top_n:]:
        rejected.append({"name": m.name, "kind": "meme", "reasons": [f"상위 {top_n}개 밖 (점수 {score})"]})
    return ranked, rejected
