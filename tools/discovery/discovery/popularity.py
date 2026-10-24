"""인기도 점수: 온라인 인기도 0~10, 커뮤니티 인기도 0~10, 합의도(독립 출처 수), 식는 신호·인위적 바이럴 감점.

규칙 기반, 외부 호출 없음. 링크가 열리는지는 점수에 쓰지 않는다(링크 정보는 verify_links로 표시용만).
총점 = clamp((온라인 + 커뮤니티) x 5 x 합의 계수 - 식는 신호 감점 - 인위적 바이럴 감점, 0, 100)
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .evidence import num
from .link_check import Fetch, UNVERIFIED, check_link

DEFAULTS: dict[str, Any] = {
    "online_value_cap": 100_000_000, "extra_platform_bonus": 0.5, "extra_platform_bonus_cap": 1.5,
    "velocity_min": 0.8, "velocity_span": 0.4, "velocity_rate_cap_log": 6,
    "community_mention_cap": 100_000, "community_upvote_cap": 1_000_000,
    "breadth_base": 0.4, "breadth_per_community": 0.2, "counter_penalty_max": 4,
    "consensus_factors": {"1": 0.7, "2": 0.9, "3": 1.0},
    "fading_penalty": 10, "astroturf_penalty": 15,
}


def parse_time(s: Any) -> datetime | None:
    if not isinstance(s, str):
        return None
    s = s.strip()
    if re.fullmatch(r"\d{4}", s):
        s += "-01-01"
    elif re.fullmatch(r"\d{4}-\d{2}", s):
        s += "-01"
    try:
        dt = datetime.fromisoformat(s)
    except (TypeError, ValueError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _log_scale(x: float, cap: float) -> float:
    """0~10: log10(1+x)를 log10(1+cap)에 대한 비율로."""
    return 10 * math.log10(1 + max(0.0, min(x, cap))) / math.log10(1 + cap)


def _cfg(w: dict[str, Any] | None) -> dict[str, Any]:
    return {**DEFAULTS, **((w or {}).get("popularity") or {})}


def _norm(s: str) -> str:
    return " ".join(s.lower().split())


# ---- 온라인 ----

def velocity_factor(e: dict[str, Any], c: dict[str, Any]) -> float:
    """확산 속도 가중(0.8~1.2). 하루 증가량(growth/7 또는 값/시작 후 일수)의 로그 눈금. 정보 없으면 1.0."""
    g = num(e.get("growth"))
    rate = g / 7 if g is not None else None
    if rate is None:
        t0, t1 = parse_time(e.get("since")), parse_time(e.get("measured_at"))
        if t0 and t1 and t1 >= t0:
            days = max(1, (t1 - t0).days)
            rate = (num(e.get("value_approx")) or 0.0) / days
    if rate is None:
        return 1.0
    scale = min(1.0, max(0.0, math.log10(1 + max(0.0, rate)) / c["velocity_rate_cap_log"]))
    return c["velocity_min"] + c["velocity_span"] * scale


def online_item_score(e: dict[str, Any], c: dict[str, Any]) -> float:
    tier_pts = 2.0 * (e.get("tier") or 1)                 # 1~5 → 2~10
    v = num(e.get("value_approx")) or 0.0
    base = 0.5 * tier_pts + 0.5 * _log_scale(v, c["online_value_cap"]) if v > 0 else 0.5 * tier_pts
    return min(10.0, base * velocity_factor(e, c))


def score_online(items: list[dict[str, Any]], c: dict[str, Any]) -> tuple[float, str]:
    if not items:
        return 0.0, "온라인 인기도 근거 없음"
    best = max(online_item_score(e, c) for e in items)
    plats = {_norm(e.get("platform", "")) for e in items}
    bonus = min(c["extra_platform_bonus_cap"], c["extra_platform_bonus"] * (len(plats) - 1))
    return min(10.0, best + bonus), ""


# ---- 커뮤니티 ----

def independent_communities(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [e for e in items if e.get("independent", True)]


def score_community(items: list[dict[str, Any]], c: dict[str, Any]) -> tuple[float, str]:
    if not items:
        return 0.0, "커뮤니티 인기도 근거 없음"
    ind = independent_communities(items)
    names = {_norm(e.get("community", "")) for e in ind}
    mentions = sum(num(e.get("mentions")) or 0.0 for e in ind)
    upvotes = sum(num(e.get("upvotes_approx")) or 0.0 for e in ind)
    ms = _log_scale(mentions, c["community_mention_cap"])
    us = _log_scale(upvotes, c["community_upvote_cap"])
    size = 0.6 * ms + 0.4 * us if upvotes > 0 and mentions > 0 else max(ms, us)
    breadth = min(1.0, c["breadth_base"] + c["breadth_per_community"] * len(names))
    # 반대 의견: negative 1, mixed 0.5, counter_view 있으면 +0.25 (항목당 최대 1)
    opp = 0.0
    for e in items:
        o = {"negative": 1.0, "mixed": 0.5}.get(e.get("sentiment"), 0.0) + (0.25 if e.get("counter_view") else 0.0)
        opp += min(1.0, o)
    penalty = c["counter_penalty_max"] * opp / len(items)
    score = max(0.0, min(10.0, size * breadth - penalty))
    note = ""
    if not ind:
        note = "독립 근거 없음(모두 앞 근거의 재인용)"
    elif mentions == 0 and upvotes == 0:
        note = "언급·업보트 규모 입력 없음"
    return score, note


# ---- 합의도 ----

def consensus(online: list[dict[str, Any]], community: list[dict[str, Any]], c: dict[str, Any]) -> dict[str, Any]:
    """독립 출처 수 = 온라인 플랫폼(이름 기준) + 독립 커뮤니티를 이름으로 합친 개수.
    1이면 단일 출처 x0.7, 2이면 x0.9, 3 이상이면 x1.0. 긍정과 부정이 섞이면 split(엇갈림)."""
    shown: dict[str, str] = {}
    for e in online:
        if e.get("platform"):
            shown.setdefault(_norm(e["platform"]), e["platform"])
    for e in independent_communities(community):
        if e.get("community"):
            shown.setdefault(_norm(e["community"]), e["community"])
    names = set(shown)
    n = len(names)
    f = c["consensus_factors"]
    factor = 0.0 if n == 0 else float(f.get(str(min(n, 3)), 1.0))
    sents = {e.get("sentiment") for e in community}
    split = "positive" in sents and bool(sents & {"negative", "mixed"}) or "mixed" in sents and len(community) > 1
    if n == 0:
        label = "근거 없음"
    elif n == 1:
        label = "단일 출처"
    elif n == 2:
        label = "독립 출처 2개(약한 합의)"
    else:
        label = f"독립 출처 {n}개(합의)"
    if split and n:
        label += ", 의견 엇갈림"
    return {"independent_sources": n, "label": label, "factor": factor, "single_source": n == 1,
            "split": bool(split), "sources": [shown[k] for k in sorted(names)]}


@dataclass
class PopularityResult:
    scores: dict[str, float]          # online, community, consensus_factor, fading_penalty, astroturf_penalty, total
    notes: dict[str, str] = field(default_factory=dict)
    consensus: dict[str, Any] = field(default_factory=dict)

    @property
    def total(self) -> float:
        return self.scores["total"]


def compute_popularity(online: list[dict[str, Any]], community: list[dict[str, Any]],
                       fading: bool = False, astroturf_suspect: bool = False,
                       w: dict[str, Any] | None = None) -> PopularityResult:
    c = _cfg(w)
    on, on_note = score_online(online, c)
    co, co_note = score_community(community, c)
    cons = consensus(online, community, c)
    fp = float(c["fading_penalty"]) if fading else 0.0
    ap = float(c["astroturf_penalty"]) if astroturf_suspect else 0.0
    total = (on + co) * 5 * cons["factor"] - fp - ap
    total = max(0.0, min(100.0, total))
    notes = {k: v for k, v in (("online", on_note), ("community", co_note)) if v}
    if cons["single_source"]:
        notes["consensus"] = "단일 출처: 총점 x0.7"
    scores = {"online": round(on, 2), "community": round(co, 2), "consensus_factor": cons["factor"],
              "fading_penalty": fp, "astroturf_penalty": ap, "total": round(total, 2)}
    return PopularityResult(scores, notes, cons)


# ---- 링크 정보(표시용) ----

def verify_links(online: list[dict[str, Any]], community: list[dict[str, Any]], name: str,
                 fetch: Fetch) -> list[dict[str, Any]]:
    """근거 링크가 열리는지 확인한 정보. 점수·탈락에 쓰지 않는다."""
    out = []
    for kind, items, key in (("online", online, "platform"), ("community", community, "community")):
        for e in items:
            url = e.get("source_url") or e.get("url")
            if url:
                out.append({"kind": kind, "who": e.get(key, ""), "url": url,
                            "link_status": check_link(url, name, fetch)})
            elif e.get("link_status"):
                out.append({"kind": kind, "who": e.get(key, ""), "url": "", "link_status": e["link_status"]})
    return out


def background_line(meme_context: dict[str, Any] | None, scores: dict[str, float],
                    cons: dict[str, Any] | None = None) -> str:
    """규칙 기반 한 줄: 밈 요약 + 온라인·커뮤니티 점수 + 합의도."""
    summary = ((meme_context or {}).get("summary") or "").strip().rstrip(".")
    head = summary if summary else "연결된 유행 밈 정보 없음"
    if scores.get("total", 0) <= 0:
        return f"{head}. 인기도를 매길 근거 없음."
    label = (cons or {}).get("label", "")
    tail = f", 합의도: {label}" if label else ""
    return (f"{head}. 온라인 {scores['online']:g}/10 · 커뮤니티 {scores['community']:g}/10{tail}.")
