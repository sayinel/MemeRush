"""판 길이 규칙 설정 한 곳. 플레이하며 바뀔 수 있으니 초 수치는 여기서만 고친다.

정본: GAME_FRAME_SPEC 2절과 PR #18(한 판 연출).
- MemeRush 한 판 = 3라운드. 라운드마다 소개 2초 + 목표 시간 + 반응 3초, 마지막에 결과 3초.
- 첫날 목표 시간 3·4·5초: 3 x (2 + 3) + (3 + 4 + 5) + 3 = 30초. 한 판은 30~60초 안이어야 한다.
- 라운드 목표 시간은 3~5초, 숫자 밈은 7초까지.
- 후보 "원본 게임"의 한 판 길이는 상한만 둔다(계획 문서 필수 기준 "한 판 30초 이내").
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Sequence

# 날짜는 Asia/Seoul 기준. 한국은 서머타임이 없어 고정 +09:00로 충분하다(tzdata 없는 Windows에서도 동작).
KST = timezone(timedelta(hours=9))

MIN_SESSION_S = 30          # MemeRush 한 판 하한
MAX_SESSION_S = 60          # MemeRush 한 판 상한
MAX_ORIGINAL_GAME_S = 30    # 원본 인기 게임 한 판 길이 상한(하한 없음: 짧은 게임을 찾는 것)
ROUNDS = 3
ROUND_TARGET_RANGE_S = (3, 5)   # 라운드당 목표 시간
NUMBER_MEME_MAX_S = 7           # 숫자 밈은 7초까지(PR #18)
ROUND_INTRO_S = 2               # 라운드 소개
ROUND_REACT_S = 3               # 라운드 반응
FINAL_RESULT_S = 3              # 마지막 결과
FIRST_DAY_TARGETS_S = (3, 4, 5)  # 첫날 라운드별 목표 시간
DEFAULT_ROUND_TARGET_S = 4      # 밈이 목표 시간을 주지 않을 때 카드에 보여 줄 대표값
OUTLINE_ROUND_S = 10            # outline_trace 한 라운드 약 10초(GAME_FRAME_SPEC 4절)
MERGE_DROP_SESSION_S = 60       # merge_drop은 3라운드로 나누지 않고 60초 제한 한 판
LINK_BODY_MAX_BYTES = 512 * 1024  # 링크 확인 때 읽는 응답 본문 상한


def expected_session_s(play_s: Sequence[float]) -> float:
    """한 판 예상 길이(초). play_s는 라운드별 플레이(목표) 시간."""
    return sum(ROUND_INTRO_S + t + ROUND_REACT_S for t in play_s) + FINAL_RESULT_S


def session_in_range(seconds: float) -> bool:
    return MIN_SESSION_S <= seconds <= MAX_SESSION_S


def round_targets_s(rounds: int = ROUNDS, meme_s: Optional[float] = None) -> List[float]:
    """라운드별 목표 시간. 밈이 값을 주면 모든 라운드에 같은 값(규격 6절), 아니면 첫날 3·4·5초 계단."""
    if meme_s is not None:
        return [float(meme_s)] * rounds
    base = list(FIRST_DAY_TARGETS_S)
    return [float(base[min(i, len(base) - 1)]) for i in range(rounds)]


def to_kst(dt: datetime) -> datetime:
    """시각을 한국 시간으로. 시간대가 없는 값은 한국 시간으로 본다."""
    return dt.replace(tzinfo=KST) if dt.tzinfo is None else dt.astimezone(KST)


def parse_now(iso: Optional[str] = None) -> datetime:
    """--now 값(ISO)을 시간대 있는 시각으로. 없으면 지금. 시간대 없는 값은 한국 시간."""
    if not iso:
        return datetime.now(timezone.utc)
    return to_kst(datetime.fromisoformat(iso.strip().replace("Z", "+00:00")))
