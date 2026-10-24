"""적합도 점수(계획 문서 점수식). 가중치는 weights.json."""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import MAX_SESSION_S, MIN_SESSION_S, session_in_range
from .frames import FRAMES
from .models import Signal
from .popularity import PopularityResult, parse_time
from .rules import find_ip_hits

_DIR = Path(__file__).parent
TOUCH_CONTROLS = {"tap", "swipe", "hold", "drag"}  # 공통 규격 2절: 탭·누르고 있기·스와이프(드래그 포함)


def load_weights(path: Path | None = None) -> dict[str, Any]:
    return json.loads((path or _DIR / "weights.json").read_text(encoding="utf-8"))


@dataclass
class ScoreResult:
    passed: bool
    fail_reasons: list[str] = field(default_factory=list)
    parts: dict[str, float] = field(default_factory=dict)
    ip_penalty: float = 0.0
    total: float = 0.0


_parse_time = parse_time


def required_failures(sig: Signal, w: dict[str, Any]) -> list[str]:
    """필수 기준: 한 판 30~60초(config),탭·스와이프만, 점수가 숫자 하나."""
    t, reasons = sig.traits, []
    lenient = bool(t.get("inferred"))  # 추론 항목 중 글에 없는 값은 틀 기본값을 쓰므로 불명이어도 통과
    secs = t.get("session_seconds")
    if (secs is None and not lenient) or (secs is not None and not session_in_range(secs)):
        reasons.append(f"한 판 {secs}초: {MIN_SESSION_S}~{MAX_SESSION_S}초 밖 또는 불명")
    controls = t.get("controls") or []
    if (not controls and not lenient) or not set(controls) <= TOUCH_CONTROLS:
        reasons.append(f"탭·스와이프 외 조작 필요: {controls}")
    if t.get("score_type") != "single_number" and not (lenient and not t.get("score_type")):
        reasons.append(f"점수가 숫자 하나가 아님: {t.get('score_type')}")
    return reasons


def ip_penalty(sig: Signal, ip_terms: dict[str, list[str]], w: dict[str, Any]) -> float:
    hits = find_ip_hits(sig, ip_terms)
    if any(h["where"] == "rule" for h in hits):
        return float(w["ip_rule_penalty"])
    if hits:
        return float(w["ip_name_penalty"])
    return 0.0


def signal_strength(sig: Signal, w: dict[str, Any], now: datetime) -> float:
    """옛 입력(online·community 없음)용 대체 계산. 0~signal_strength. 7일 초과는 절반. 링크는 보지 않는다."""
    growth = sig.metrics.get("growth")
    if growth is None:
        nums = [v for v in sig.metrics.values() if isinstance(v, (int, float))]
        growth = max(nums) if nums else 0
    cap = w["strength_cap"]
    val = math.log10(1 + max(0, min(growth, cap))) / math.log10(1 + cap)
    val *= w["signal_strength"]
    at = _parse_time(sig.measured_at)
    if at is None or (now - at).total_seconds() > w["decay_days"] * 86400:
        val *= w["decay_factor"]
    return val


def score_signal(sig: Signal, w: dict[str, Any],
                 ip_terms: dict[str, list[str]], now: datetime,
                 popularity: PopularityResult | None = None) -> ScoreResult:
    """popularity가 있으면 신호 강도 = 인기도 총점(0~100)을 신호 강도 만점으로 환산.
    없으면(online·community 입력이 없는 옛 입력) metrics의 growth 계산으로 대체(하위 호환).
    링크 열림 여부는 점수에 쓰지 않는다."""
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    t = sig.traits
    fails = required_failures(sig, w)
    pen = ip_penalty(sig, ip_terms, w)

    inferred = bool(t.get("inferred"))
    impl = t.get("impl_ease")
    if impl is None and inferred and sig.frame_guess in FRAMES:  # 추론 입력은 틀 난이도(5/3/1)를 구현 쉬움으로
        impl = FRAMES[sig.frame_guess].difficulty_score
    ease = max(0, min(5, impl or 0)) / 5
    secs = t.get("session_seconds")
    if secs is None:
        length = 0.75 if inferred else 0.0  # 추론 입력: 글에 없으면 틀 기본 길이 중간값
    else:
        # 30초 이하 만점, 60초 0.5 (범위는 config)
        length = max(0.0, min(1.0, 1 - (secs - MIN_SESSION_S) / (2 * (MAX_SESSION_S - MIN_SESSION_S))))
    simple = {"single_number": 1.0, "multiple": 0.4}.get(t.get("score_type"), 1.0 if inferred else 0.0)
    controls = set(t.get("controls") or [])
    if controls == {"tap"}:
        ctrl = 1.0
    elif controls and controls <= TOUCH_CONTROLS:
        ctrl = 0.8
    else:
        ctrl = 0.8 if inferred and not controls else 0.0
    parts = {
        "impl_ease": ease * w["impl_ease"],
        "session_length": length * w["session_length"],
        "score_simplicity": simple * w["score_simplicity"],
        "control_simplicity": ctrl * w["control_simplicity"],
        "signal_strength": (popularity.total / w.get("popularity_max", 100) * w["signal_strength"]
                            if popularity is not None
                            else signal_strength(sig, w, now)),
    }
    passed = not fails
    total = (sum(parts.values()) - pen) if passed else 0.0
    return ScoreResult(passed, fails, parts, pen, round(max(0.0, total), 2))
