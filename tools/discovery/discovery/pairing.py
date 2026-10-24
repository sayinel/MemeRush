"""틀 × 밈 조합 점수, 최근 사용 감점, 하루 판 JSON 초안, decide(history 기록). GAME_FRAME_SPEC 5·6절.

조합 점수(0~100) = 틀 인기도 x 밈 인기도 x 적합도 x 구현 쉬움 x 최근 사용 감점
- 틀 인기도: 그 틀로 연결된 게임들의 인기도 총점 중 최고(0~1로 환산)
- 밈 인기도: 밈 인기도 총점(0~1)
- 적합도: 틀의 "잘 맞는 밈 유형"과 밈 type이 같으면 1.0, 유형 순서에서 한 칸 떨어지면 0.6, 아니면 0.3
- 구현 쉬움: 0.5 + 난이도 점수/10 (낮음 1.0, 중간 0.8, 높음 0.6)
- 최근 사용: 같은 틀이 직전 2일(어제·그제) 모두 쓰였으면 x0.5
"""
from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from .config import DEFAULT_ROUND_TARGET_S, ROUNDS, expected_session_s, session_in_range
from .frames import FRAMES, clamp_params
from .memes import MEME_TYPES

FIT_SAME, FIT_NEAR, FIT_FAR = 1.0, 0.6, 0.3
RECENT_PENALTY = 0.5


def fit_score(frame_id: str, meme_type: str) -> float:
    if meme_type not in MEME_TYPES:
        return FIT_FAR
    i = MEME_TYPES.index(meme_type)
    dist = min(abs(i - MEME_TYPES.index(t)) for t in FRAMES[frame_id].fits)
    return FIT_SAME if dist == 0 else FIT_NEAR if dist == 1 else FIT_FAR


def ease_factor(frame_id: str) -> float:
    return round(0.5 + FRAMES[frame_id].difficulty_score / 10, 2)


def best_frame_for_meme(meme_type: str) -> str:
    """밈 유형만 보고 가장 잘 맞는 틀(적합도 동률이면 구현이 쉬운 쪽, 그다음 틀 순서)."""
    return max(FRAMES, key=lambda f: (fit_score(f, meme_type), FRAMES[f].difficulty_score,
                                      -list(FRAMES).index(f)))


# ---------------- history ----------------

def load_history(path: str | Path) -> list[dict[str, str]]:
    p = Path(path)
    if not p.exists():
        return []
    out = []
    for line in p.read_text(encoding="utf-8").splitlines():
        if line.strip():
            d = json.loads(line)
            if "date" in d and "frame" in d:
                out.append({"date": str(d["date"]), "frame": str(d["frame"])})
    return out


def record_decision(path: str | Path, day: str, frame_id: str) -> None:
    """같은 날짜 기록은 새 것으로 바꾼다(하루에 판 하나)."""
    if frame_id not in FRAMES:
        raise ValueError(f"알 수 없는 틀: {frame_id} (가능: {', '.join(FRAMES)})")
    date.fromisoformat(day)
    rows = [h for h in load_history(path) if h["date"] != day] + [{"date": day, "frame": frame_id}]
    rows.sort(key=lambda h: h["date"])
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("".join(json.dumps(h, ensure_ascii=False) + "\n" for h in rows), encoding="utf-8")


def recency_factor(frame_id: str, history: list[dict[str, str]], today: date) -> float:
    days = {(today - timedelta(days=n)).isoformat() for n in (1, 2)}
    used = {h["date"] for h in history if h["frame"] == frame_id and h["date"] in days}
    return RECENT_PENALTY if used == days else 1.0


# ---------------- 조합 ----------------

def frame_stats(cands: list[Any]) -> dict[str, dict[str, Any]]:
    """틀 id → {popularity(연결된 게임 인기도 최고), games, inferred(최고 게임이 추론값인가)}."""
    stats: dict[str, dict[str, Any]] = {}
    for c in cands:
        if not c.frame or c.frame not in FRAMES:
            continue
        s = stats.setdefault(c.frame, {"popularity": -1.0, "games": [], "inferred": False})
        s["games"].append(c.name)
        if c.popularity_total > s["popularity"]:
            s["popularity"], s["inferred"] = c.popularity_total, bool(c.inferred)
    return stats


def build_params(frame_id: str, meme: dict[str, Any]) -> dict[str, Any]:
    """틀 기본값에 밈 힌트(목표 시간, bpm, speed)를 얹고 범위로 맞춘다."""
    h = meme["meme_card_hint"]
    p: dict[str, Any] = {}
    fph = h.get("frameParamsHint") or {}
    if frame_id == "timing_stop":
        p["targetMs"] = h["targetMs"] if h.get("targetMs") is not None else DEFAULT_ROUND_TARGET_S * 1000
        p["rounds"] = ROUNDS
    elif frame_id == "tap_rush" and "bpm" in fph:
        p["bpm"] = fph["bpm"]
    elif frame_id == "swipe_dodge" and "speed" in fph:
        p["speed"] = fph["speed"]
    return clamp_params(frame_id, p)


def day_plan(frame_id: str, meme: dict[str, Any], day: str, number: int) -> dict[str, Any]:
    """GAME_FRAME_SPEC 6절 모양."""
    h = meme["meme_card_hint"]
    hint: dict[str, Any] = {"name": meme["name"], "type": meme["type"], **meme["meme_context"],
                            "targetReason": h["targetReason"], "useMode": meme["use_mode"]}
    if h.get("targetMs") is not None:
        hint["targetMs"] = h["targetMs"]
    if h.get("frameParamsHint"):
        hint["frameParamsHint"] = h["frameParamsHint"]
    params = build_params(frame_id, meme)
    plan = {"id": day, "title": f"MemeRush Daily #{number:03d}", "frame": frame_id,
            "frameParams": params, "seed": day, "meme": hint}
    if FRAMES[frame_id].score_direction == "asc":  # 점수가 오차 합산(낮을수록 좋음)인 틀
        plan["rounds"] = params.get("rounds", ROUNDS)
        plan["scoreRule"] = "sum_of_errors"
        if "targetMs" in params:
            est = expected_session_s(plan["rounds"], params["targetMs"] / 1000)
            plan["expectedSessionS"] = round(est, 2)
            plan["sessionInRange"] = session_in_range(est)
    return plan


def build_combos(cands: list[Any], memes: list[dict[str, Any]], history: list[dict[str, str]],
                 today: date, top_n: int = 3) -> list[dict[str, Any]]:
    stats = frame_stats(cands)
    days = {h["date"] for h in history} | {today.isoformat()}
    number = len(days)
    combos = []
    for fid, st in stats.items():
        for m in memes:
            fp, mp = st["popularity"] / 100, m["popularity_total"] / 100
            fit, ease, rec = fit_score(fid, m["type"]), ease_factor(fid), recency_factor(fid, history, today)
            combos.append({
                "frame": fid, "meme": m["name"], "meme_type": m["type"],
                "score": round(fp * mp * fit * ease * rec * 100, 2),
                "parts": {"frame_popularity": st["popularity"], "meme_popularity": m["popularity_total"],
                          "fit": fit, "ease": ease, "recency": rec},
                "games": st["games"], "inferred": st["inferred"],
                "confidence": "낮음(추론값)" if st["inferred"] else "보통",
                "plan": day_plan(fid, m, today.isoformat(), number)})
    combos.sort(key=lambda c: (-c["score"], c["frame"], c["meme"]))
    return combos[:top_n]


def render_combos(combos: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    for i, c in enumerate(combos, 1):
        p = c["parts"]
        lines += [f"### 조합 {i}: {c['frame']} × {c['meme']} — {c['score']}점",
                  f"- 틀 `{c['frame']}` ({FRAMES[c['frame']].rule}) / 연결된 게임: {', '.join(c['games'])}",
                  f"- 계산: 틀 인기도 {p['frame_popularity']:g} x 밈 인기도 {p['meme_popularity']:g} "
                  f"x 적합도 {p['fit']:g}({c['meme_type']}) x 구현 쉬움 {p['ease']:g} x 최근 사용 {p['recency']:g}",
                  "- 신뢰: " + (f"⚠ 추론값 — {c['confidence']} (틀 연결 근거 게임의 traits를 규칙으로 추론함)"
                              if c["inferred"] else c["confidence"]),
                  "- 하루 판 초안:", "```json", json.dumps(c["plan"], ensure_ascii=False, indent=2), "```", ""]
    lines.append("판을 정하면: `python -m discovery decide --date <날짜> --frame <틀 id>` (같은 틀이 연속 나오지 않게 기록)")
    return lines
