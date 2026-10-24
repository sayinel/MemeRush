"""게임 틀 라이브러리 v1 (GAME_FRAME_SPEC 4절)을 데이터로 정의하고, 글에서 가장 가까운 틀을 규칙으로 고른다.

- 난이도 점수: 낮음=5, 중간=3, 높음=1 (구현이 쉬울수록 높다).
- fits: 이 틀과 잘 맞는 밈 유형(memes.MEME_TYPES). 적합도 계산은 pairing.fit_score.
- params: 숫자 파라미터의 기본값과 범위(문자 파라미터는 choices). `seed`는 하루 판 파일 최상위(6절)에 둔다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .config import (FIRST_DAY_TARGETS_S, MAX_SESSION_S, MERGE_DROP_SESSION_S, MIN_SESSION_S,
                     NUMBER_MEME_MAX_S, OUTLINE_ROUND_S, ROUND_TARGET_RANGE_S, ROUNDS, expected_session_s)

_TLO, _THI = ROUND_TARGET_RANGE_S
MIN_VISIBLE_HIDDEN_MS = 500  # visibleMs는 가장 짧은 목표 시간보다 최소 0.5초 짧게(시계가 숨겨지도록)

DIFFICULTY_SCORE ={"낮음": 5, "중간": 3, "높음": 1}


@dataclass(frozen=True)
class Frame:
    id: str
    rule: str
    score_direction: str            # "asc" 낮을수록 좋음 / "desc" 높을수록 좋음
    difficulty: str                 # 낮음 | 중간 | 높음
    fits: tuple[str, ...]           # 잘 맞는 밈 유형
    params: dict[str, dict[str, Any]]
    validation: str                 # 서버 검증 한 줄
    keywords: tuple[str, ...] = field(default_factory=tuple)  # frame_guess 규칙어(정규식)

    @property
    def difficulty_score(self) -> int:
        return DIFFICULTY_SCORE[self.difficulty]

    def default_params(self) -> dict[str, Any]:
        return {k: (list(v["default"]) if v.get("per_round") else v["default"]) for k, v in self.params.items()}


def _n(default, lo, hi):
    return {"default": default, "min": lo, "max": hi}


def _per_round(default_ms, lo, hi):
    """라운드별 값 배열(길이 = rounds). 숫자 하나를 주면 모든 라운드에 같은 값(규격 6절)."""
    return {"default": list(default_ms), "min": lo, "max": hi, "per_round": True}


_ROUNDS = _n(ROUNDS, 1, 5)

FRAME_LIST = [
    # 규격 4절: targetMs는 라운드별 각 3000~5000, 숫자 밈은 7000까지. visibleMs < targetMs.
    Frame("timing_stop", "숨겨진 타이머를 목표 시간에 맞춰 한 번 탭해 멈춘다", "asc", "낮음",
          ("number", "timing"),
          {"rounds": _ROUNDS,
           "targetMs": _per_round([t * 1000 for t in FIRST_DAY_TARGETS_S], _TLO * 1000, NUMBER_MEME_MAX_S * 1000),
           "visibleMs": _n(1500, 500, 2500)},
          f"한 판 {MIN_SESSION_S}~{MAX_SESSION_S}초, 라운드별 목표 {_TLO}~{_THI}초(숫자 밈 {NUMBER_MEME_MAX_S}초), "
          "서버 경과보다 길면 거부",
          ("타이머", "멈춘", "멈추", "정지", "스톱워치")),
    Frame("tap_rush", "제한 시간 동안 박자나 표시에 맞춰 최대한 많이 탭", "desc", "낮음",
          ("rhythm",),  # 리듬·반복 동작 밈. 장애물·일상 노동(obstacle)은 한 칸 떨어진 0.6, swipe_dodge가 1.0
          {"rounds": _ROUNDS, "durationMs": _n(10000, 8000, 12000), "bpm": _n(120, 60, 180)},
          "초당 탭 수 상한(12)",
          ("연타", "박자", "리듬", "탭 횟수")),
    Frame("swipe_dodge", "좌우로 밀어 떨어지는 장애물을 피하고 오래 버틴다", "desc", "중간",
          ("obstacle",),
          {"rounds": _ROUNDS, "roundCapMs": _n(10000, 5000, 15000), "speed": _n(3, 1, 8), "gap": _n(120, 80, 240)},
          "생존 시간이 서버 경과를 넘지 못함",
          ("피하", "피해", "피한", "장애물", "통과", "점프")),
    Frame("gauge_stop", "움직이는 게이지가 목표 구간에 있을 때 탭", "asc", "낮음",  # 점수 = 목표 구간 중심과의 거리 합
          ("timing",),
          {"zoneStart": _n(0.4, 0.0, 0.9), "zoneEnd": _n(0.6, 0.1, 1.0),
           "speed": _n(2, 1, 5), "rounds": _ROUNDS},
          "라운드 수와 점수 범위",
          ("게이지", "타이밍에 맞춰")),
    Frame("outline_trace", "손가락으로 외곽선을 따라가며 벗어나지 않는다", "desc", "중간",
          ("format",),
          {"rounds": _ROUNDS,  # 모양 하나당 한 라운드, 약 10초
           "shape": {"default": "circle", "choices": ["circle", "star", "heart"]},
           "tolerance": _n(24, 8, 48)},
          "완주 시간 하한",
          (r"(?<!에 )(?<!에)따라(?!서)", "외곽선", "그어")),
    Frame("merge_drop", "같은 것끼리 합쳐 큰 것을 만든다", "desc", "높음",
          ("format",),
          {"rounds": _n(1, 1, 1), "durationMs": _n(MERGE_DROP_SESSION_S * 1000, MERGE_DROP_SESSION_S * 1000,
                                                    MERGE_DROP_SESSION_S * 1000),  # 3라운드로 나누지 않고 60초 한 판
           "boardSize": _n(5, 4, 7)},
          "점수 상한",
          ("합쳐", "합치", "머지", "떨어뜨려")),
]
FRAMES: dict[str, Frame] = {f.id: f for f in FRAME_LIST}
FRAME_ORDER = [f.id for f in FRAME_LIST]


def guess_frame(text: str) -> tuple[str | None, list[str]]:
    """글 한 토막에서 규칙어가 가장 많이 맞는 틀. 동률이면 FRAME_ORDER 앞쪽. 없으면 (None, [])."""
    best: tuple[int, str | None, list[str]] = (0, None, [])
    for f in FRAME_LIST:
        hits = [m.group(0) for kw in f.keywords for m in [re.search(kw, text or "")] if m]
        if len(hits) > best[0]:
            best = (len(hits), f.id, hits)
    return best[1], best[2]


def clamp_params(frame_id: str, params: dict[str, Any]) -> dict[str, Any]:
    """틀이 정한 범위로 맞춘다. 모르는 키는 버리고, 빠진 키는 기본값."""
    spec = FRAMES[frame_id].params
    out: dict[str, Any] = {}
    if "rounds" in spec:  # 라운드별 배열의 길이가 정해지므로 먼저 맞춘다
        s = spec["rounds"]
        out["rounds"] = int(max(s["min"], min(s["max"], params.get("rounds", s["default"]))))
    for k, s in spec.items():
        if k == "rounds":
            continue
        v = params.get(k, s["default"])
        if "choices" in s:
            out[k] = v if v in s["choices"] else s["default"]
        elif s.get("per_round"):
            vals = list(v) if isinstance(v, (list, tuple)) else [v]
            vals = [int(max(s["min"], min(s["max"], x))) for x in vals]
            n = out.get("rounds", len(vals))
            out[k] = (vals + [vals[-1]] * n)[:n]
        else:
            v = max(s["min"], min(s["max"], v))
            out[k] = int(v) if isinstance(s["default"], int) else round(float(v), 3)
    if frame_id == "timing_stop":  # visibleMs < targetMs: 가장 짧은 목표보다 짧게 해 시계가 숨겨지게
        out["visibleMs"] = min(out["visibleMs"], min(out["targetMs"]) - MIN_VISIBLE_HIDDEN_MS)
    return out


def play_seconds(frame_id: str, params: dict[str, Any]) -> list[float] | None:
    """라운드별 플레이 시간(초). 틀 파라미터에서 알 수 없으면 None(gauge_stop)."""
    rounds = int(params.get("rounds", ROUNDS))
    if frame_id == "timing_stop":
        return [t / 1000 for t in params["targetMs"]]
    if frame_id == "tap_rush":
        return [params["durationMs"] / 1000] * rounds
    if frame_id == "swipe_dodge":
        return [params["roundCapMs"] / 1000] * rounds
    if frame_id == "outline_trace":
        return [float(OUTLINE_ROUND_S)] * rounds
    if frame_id == "merge_drop":
        return [params["durationMs"] / 1000]
    return None


def session_estimate(frame_id: str, params: dict[str, Any]) -> float | None:
    """한 판 예상 길이(초). merge_drop은 60초 제한 한 판 그대로, 나머지는 라운드별 소개 2 + 시간 + 반응 3, 결과 3."""
    play = play_seconds(frame_id, params)
    if play is None:
        return None
    if frame_id == "merge_drop":
        return float(play[0])
    return expected_session_s(play)
