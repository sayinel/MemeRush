"""판 길이 규칙 설정 한 곳 (사장님 결정 2026-10-24). 플레이하며 바뀔 수 있으니 숫자는 여기서만 고친다.

- 한 판 30~60초, 3라운드, 라운드당 목표 시간 3~5초.
- 한 판 예상 길이 = 라운드 수 x (목표 시간 + 라운드 여유 ROUND_SLACK_S).
"""
MIN_SESSION_S = 30
MAX_SESSION_S = 60
ROUNDS = 3
ROUND_TARGET_RANGE_S = (3, 5)
ROUND_SLACK_S = 2          # 라운드마다 붙는 여유(준비·결과 표시) 약 2초
DEFAULT_ROUND_TARGET_S = 4  # 목표 시간 제안이 없을 때


def expected_session_s(rounds: int, target_s: float) -> float:
    return rounds * (target_s + ROUND_SLACK_S)


def session_in_range(seconds: float) -> bool:
    return MIN_SESSION_S <= seconds <= MAX_SESSION_S
