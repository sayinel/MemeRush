"""소스 어댑터. 모두 `collect() -> list[Signal]` 를 가진다."""
from __future__ import annotations

from typing import Protocol

from ..models import Signal


class Source(Protocol):
    def collect(self) -> list[Signal]: ...
