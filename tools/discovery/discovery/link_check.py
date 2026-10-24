"""링크 검증: 확인됨 / 열림-이름불일치 / 열리지 않음 / 미확인."""
from __future__ import annotations

from typing import Callable

CONFIRMED = "확인됨"
NAME_MISMATCH = "열림-이름불일치"
NOT_OPEN = "열리지 않음"
UNVERIFIED = "미확인"

# fetch(url, timeout) -> (status_code, body_text). 시간초과 등은 예외로 던진다.
Fetch = Callable[[str, float], tuple[int, str]]


def httpx_fetch(url: str, timeout: float) -> tuple[int, str]:
    import httpx  # 지연 import: 시험에서는 필요 없음

    r = httpx.get(url, timeout=timeout, follow_redirects=True,
                  headers={"User-Agent": "meme-rush-discovery/0"})
    return r.status_code, r.text


def _norm(s: str) -> str:
    return " ".join(s.lower().split())


def name_in_text(name: str, text: str) -> bool:
    return _norm(name) in _norm(text)


def check_link(url: str, name: str, fetch: Fetch | None = None,
               timeout: float = 8.0) -> str:
    fetch = fetch or httpx_fetch
    try:
        status, body = fetch(url, timeout)
    except Exception:  # 시간초과·연결 오류: 닫혔는지 모르므로 미확인
        return UNVERIFIED
    if 200 <= status < 300:
        return CONFIRMED if name_in_text(name, body or "") else NAME_MISMATCH
    if status in (404, 410) or status >= 500:
        return NOT_OPEN
    return UNVERIFIED  # 429, 403 등 접속 제한
