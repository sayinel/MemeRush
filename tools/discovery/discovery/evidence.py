"""인기 근거 입력 정규화: online[] / community[] 모양, tier 계산, 옛 popularity_evidence 변환.

링크 열림(url, link_status)은 정보 표시용 부가 필드일 뿐이고 점수·탈락에는 쓰지 않는다.
"""
from __future__ import annotations

from typing import Any

SENTIMENTS = ("positive", "mixed", "negative")
_TIER_BOUNDS = (1_000, 10_000, 100_000, 1_000_000)  # 미만이면 1,2,3,4 / 이상이면 5
_ONLINE_EXTRA = ("rank", "prev_rank", "growth", "url", "link_status", "sim")
_COMMUNITY_EXTRA = ("url", "link_status", "sim")


def num(v: Any) -> float | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return None


def derive_tier(value: float | None) -> int:
    """대략 숫자 → 영향 규모 눈금 1~5 (1천 미만 1, 1만 2, 10만 3, 100만 4, 그 이상 5)."""
    v = value or 0.0
    for i, b in enumerate(_TIER_BOUNDS, 1):
        if v < b:
            return i
    return 5


def truthy(v: Any) -> bool:
    if isinstance(v, str):
        return v.strip().lower() in ("true", "yes", "y", "1", "예", "있음", "의심")
    return bool(v)


def normalize_online(e: dict[str, Any], issues: list[str], legacy: bool = False) -> dict[str, Any] | None:
    platform = str(e.get("platform") or "").strip()
    if not platform:
        issues.append("online 항목에 platform 없음: 건너뜀")
        return None
    v = num(e.get("value_approx"))
    if v is None:
        v = num(e.get("value"))
    if v is None or v < 0:
        issues.append(f"online[{platform}] value_approx 없음/음수: 0으로 처리")
        v = 0.0
    t = e.get("tier")
    if isinstance(t, bool) or not isinstance(t, (int, float)):
        t = derive_tier(v)
        if e.get("tier") is not None:
            issues.append(f"online[{platform}] tier 형식 오류: 값에서 계산({t})")
    t = int(max(1, min(5, round(t))))
    out: dict[str, Any] = {
        "platform": platform, "metric": str(e.get("metric") or ""), "value_approx": v, "tier": t,
        "since": str(e.get("since") or ""), "measured_at": str(e.get("measured_at") or ""),
        "source_name": str(e.get("source_name") or (platform if legacy else "")),
    }
    src = e.get("source_url") or (e.get("url") if legacy else None)
    if src:
        out["source_url"] = str(src)
    for k in _ONLINE_EXTRA:
        if e.get(k) is not None and k not in out:
            out[k] = e[k]
    return out


def normalize_community(e: dict[str, Any], issues: list[str]) -> dict[str, Any] | None:
    name = str(e.get("community") or "").strip()
    if not name:
        issues.append("community 항목에 community 없음: 건너뜀")
        return None
    out: dict[str, Any] = {"community": name}
    for k in ("mentions", "upvotes_approx"):
        v = num(e.get(k))
        if v is None or v < 0:
            if e.get(k) is not None:
                issues.append(f"community[{name}] {k} 형식 오류: 0으로 처리")
            v = 0.0
        out[k] = v
    s = e.get("sentiment")
    if s not in SENTIMENTS:
        if s is not None:
            issues.append(f"community[{name}] sentiment '{s}' 알 수 없음: positive로 처리")
        s = "positive"
    out["sentiment"] = s
    out["independent"] = True if e.get("independent") is None else truthy(e.get("independent"))
    if e.get("counter_view"):
        out["counter_view"] = str(e["counter_view"])
    out["source_name"] = str(e.get("source_name") or "")
    if e.get("source_url"):
        out["source_url"] = str(e["source_url"])
    for k in _COMMUNITY_EXTRA:
        if e.get(k) is not None:
            out[k] = e[k]
    return out


def normalize_evidence(d: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    """입력 dict에서 (online, community, issues). 옛 popularity_evidence는 online으로 변환."""
    issues: list[str] = []
    online = [x for x in (normalize_online(dict(e), issues) for e in (d.get("online") or [])) if x]
    legacy = d.get("popularity_evidence") or []
    if legacy and not d.get("online"):
        issues.append(f"옛 popularity_evidence {len(legacy)}건을 online으로 변환")
        online += [x for x in (normalize_online(dict(e), issues, legacy=True) for e in legacy) if x]
    community = [x for x in (normalize_community(dict(e), issues) for e in (d.get("community") or [])) if x]
    return online, community, issues


def is_sample(*notes: Any) -> bool:
    return any(isinstance(n, str) and ("가상" in n or "샘플" in n) for n in notes)
