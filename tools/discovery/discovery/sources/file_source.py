"""파일 읽기 어댑터: signals.json(리스트 또는 {"signals": [...]})."""
from __future__ import annotations

import json
from pathlib import Path

from ..evidence import is_sample
from ..models import Signal


class FileSource:
    def __init__(self, path: str | Path):
        self.path = Path(path)

    def collect(self) -> list[Signal]:
        data = json.loads(self.path.read_text(encoding="utf-8"))
        items = data["signals"] if isinstance(data, dict) else data
        sample = isinstance(data, dict) and is_sample(data.get("_note"))
        return [Signal.from_dict(d, sample=sample) for d in items]
