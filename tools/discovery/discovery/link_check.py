"""링크 검증: 확인됨 / 열림-이름불일치 / 열리지 않음 / 미확인."""
from __future__ import annotations

from typing import Any, Callable, Iterable

from .config import LINK_BODY_MAX_BYTES

CONFIRMED = "확인됨"
NAME_MISMATCH = "열림-이름불일치"
NOT_OPEN = "열리지 않음"
UNVERIFIED = "미확인"

# fetch(url, timeout) -> (status_code, body_text). 시간초과 등은 예외로 던진다.
Fetch = Callable[[str, float], tuple[int, str]]


def read_capped(chunks: Iterable[bytes], limit: int) -> bytes:
    """응답 조각을 limit 바이트까지만 모은다(그 이상은 읽지 않고 멈춤)."""
    buf = bytearray()
    for ch in chunks:
        buf += ch
        if len(buf) >= limit:
            break
    return bytes(buf[:limit])


def httpx_fetch(url: str, timeout: float) -> tuple[int, str]:
    import httpx  # 지연 import: 시험에서는 필요 없음

    with httpx.stream("GET", url, timeout=timeout, follow_redirects=True,
                      headers={"User-Agent": "meme-rush-discovery/0"}) as r:
        raw = read_capped(r.iter_bytes(), LINK_BODY_MAX_BYTES)  # 이름 확인에는 앞부분이면 충분
        try:
            text = raw.decode(r.encoding or "utf-8", errors="replace")
        except LookupError:
            text = raw.decode("utf-8", errors="replace")
        return r.status_code, text


def memoize_fetch(fetch: Fetch) -> Fetch:
    """같은 URL은 한 번만 연다(결과와 예외를 모두 기억). 한 번 실행 안에서 중복 호출로 429를 부르지 않기 위해."""
    cache: dict[str, tuple[bool, Any]] = {}

    def wrapped(url: str, timeout: float) -> tuple[int, str]:
        if url not in cache:
            try:
                cache[url] = (True, fetch(url, timeout))
            except Exception as e:  # check_link가 미확인으로 분류
                cache[url] = (False, e)
        ok, val = cache[url]
        if ok:
            return val
        raise val

    return wrapped


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
