"""게임 조사 글에서 traits(조작·판 길이·점수 유형)를 규칙으로 추론한다. LLM 없음.

추론한 값은 traits에 `inferred: true`와 `inferred_fields`로 표시하고, 카드에는 "추론값·낮은 신뢰"로 나온다.
"""
from __future__ import annotations

import re
from typing import Any

_CONTROL_WORDS = [("tap", r"탭|tap"), ("swipe", r"스와이프|swipe"),
                  ("hold", r"누르고|홀드|hold"), ("drag", r"드래그|drag")]
_SESSION = re.compile(r"(\d+(?:\.\d+)?)(?:\s*[~\-–]\s*(\d+(?:\.\d+)?))?\s*초")
_SCORE = re.compile(r"점수|횟수|기록|(?<!제한 )시간(?!\s*내)")
MIN_SESSION = 5.0  # "1초 직관성", "0.1초 재시작" 같은 말은 한 판 길이가 아니다


def infer_controls(text: str) -> list[str]:
    return [n for n, pat in _CONTROL_WORDS if re.search(pat, text or "", re.I)]


def infer_session_seconds(*texts: str) -> float | None:
    """앞 글부터 처음 나오는 5초 이상 숫자. 범위('30~60초')는 위쪽 값(판 길이 한도 검사에 보수적).
    통과 여부(원본 게임 상한 config.MAX_ORIGINAL_GAME_S)는 scoring.required_failures가 본다."""
    for t in texts:
        for m in _SESSION.finditer(t or ""):
            hi = float(m.group(2) or m.group(1))
            if hi >= MIN_SESSION:
                return hi
    return None


def infer_score_type(text: str) -> str | None:
    return "single_number" if _SCORE.search(text or "") else None


def infer_traits(rule: str, reason: str, extra: str, have: dict[str, Any]) -> dict[str, Any]:
    """have에 없는 항목만 추론해 돌려준다. rule(규칙 한 줄) > reason(인기 이유) 순으로 본다."""
    out: dict[str, Any] = {}
    if not have.get("controls"):
        c = infer_controls(rule) or infer_controls(reason)
        if c:
            out["controls"] = c
    if not have.get("session_seconds"):
        s = infer_session_seconds(rule, reason)
        if s is not None:
            out["session_seconds"] = s
    if not have.get("score_type"):
        st = infer_score_type(" ".join((rule, reason, extra)))
        if st:
            out["score_type"] = st
    return out
