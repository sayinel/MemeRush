"""게임 틀 라이브러리 v1 (GAME_FRAME_SPEC 4절)을 데이터로 정의하고, 글에서 가장 가까운 틀을 규칙으로 고른다.

- 난이도 점수: 낮음=5, 중간=3, 높음=1 (구현이 쉬울수록 높다).
- fits: 이 틀과 잘 맞는 밈 유형(memes.MEME_TYPES). 적합도 계산은 pairing.fit_score.
- params: 숫자 파라미터의 기본값과 범위(문자 파라미터는 choices). `seed`는 하루 판 파일 최상위(6절)에 둔다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .config import (DEFAULT_ROUND_TARGET_S, MAX_SESSION_S, MIN_SESSION_S, ROUND_TARGET_RANGE_S,
                     ROUNDS)

_TLO, _THI = ROUND_TARGET_RANGE_S
ROUND_FRAMES = ("timing_stop",)  # frameParams에 rounds를 넣는 라운드형 틀

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
        return {k: v["default"] for k, v in self.params.items()}


def _n(default, lo, hi):
    return {"default": default, "min": lo, "max": hi}


FRAME_LIST = [
    Frame("timing_stop", "숨겨진 타이머를 목표 시간에 맞춰 한 번 탭해 멈춘다", "asc", "낮음",
          ("number", "timing"),
          {"targetMs": _n(DEFAULT_ROUND_TARGET_S * 1000, _TLO * 1000, _THI * 1000),
           "visibleMs": _n(3000, 500, 15000),
           "rounds": _n(ROUNDS, 1, 5)},
          f"한 판 {MIN_SESSION_S}~{MAX_SESSION_S}초, 라운드당 목표 {_TLO}~{_THI}초, 서버 경과보다 길면 거부",
          ("타이머", "멈춘", "멈추", "정지", "스톱워치")),
    Frame("tap_rush", "제한 시간 동안 박자나 표시에 맞춰 최대한 많이 탭", "desc", "낮음",
          ("rhythm",),  # 반복 동작 밈(obstacle)은 한 칸 떨어진 0.6 — 장애물·노동은 swipe_dodge가 1.0
          {"durationMs": _n(MIN_SESSION_S * 1000, MIN_SESSION_S * 1000, MAX_SESSION_S * 1000),
           "bpm": _n(120, 60, 180)},
          "초당 탭 수 상한(12)",
          ("연타", "박자", "리듬", "탭 횟수")),
    Frame("swipe_dodge", "좌우로 밀어 떨어지는 장애물을 피하고 오래 버틴다", "desc", "중간",
          ("obstacle",),
          {"speed": _n(3, 1, 8), "gap": _n(120, 80, 240)},
          "생존 시간이 서버 경과를 넘지 못함",
          ("피하", "피해", "피한", "장애물", "통과", "점프")),
    Frame("gauge_stop", "움직이는 게이지가 목표 구간에 있을 때 탭", "desc", "낮음",
          ("timing",),
          {"zoneStart": _n(0.4, 0.0, 0.9), "zoneEnd": _n(0.6, 0.1, 1.0),
           "speed": _n(2, 1, 5), "rounds": _n(3, 1, 5)},
          "라운드 수와 점수 범위",
          ("게이지", "타이밍에 맞춰")),
    Frame("outline_trace", "손가락으로 외곽선을 따라가며 벗어나지 않는다", "desc", "중간",
          ("format",),
          {"shape": {"default": "circle", "choices": ["circle", "star", "heart"]},
           "tolerance": _n(24, 8, 48)},
          "완주 시간 하한",
          (r"(?<!에 )(?<!에)따라(?!서)", "외곽선", "그어")),
    Frame("merge_drop", "같은 것끼리 합쳐 큰 것을 만든다", "desc", "높음",
          ("format",),
          {"boardSize": _n(5, 4, 7)},
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
    for k, s in spec.items():
        v = params.get(k, s["default"])
        if "choices" in s:
            out[k] = v if v in s["choices"] else s["default"]
        else:
            v = max(s["min"], min(s["max"], v))
            out[k] = int(v) if isinstance(s["default"], int) else round(float(v), 3)
    return out
