"""규칙 추출: 규칙 한 줄, 새 겉모습 제안, 위험 요소. LLM 없이 notes + 키워드 사전."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .models import Signal

_DIR = Path(__file__).parent
CATEGORY_KO = {"trademarks": "상표", "characters": "캐릭터", "music": "음원"}

_SKINS = [
    "원작과 무관한 새 마스코트(예: 둥근 고양이)와 파스텔 배경",
    "네온 아케이드 풍 도형과 새로 만든 효과음",
    "종이공작 질감의 동물 캐릭터와 직접 만든 짧은 효과음",
    "우주 정거장 배경에 새 로봇 캐릭터",
]


def load_ip_terms(path: Path | None = None) -> dict[str, list[str]]:
    return json.loads((path or _DIR / "ip_terms.json").read_text(encoding="utf-8"))


def find_ip_hits(sig: Signal, ip_terms: dict[str, list[str]]) -> list[dict[str, str]]:
    """각 hit: category, term, where('rule'=notes 안, 'name'=이름만)."""
    name_l, notes_l = sig.name.lower(), sig.notes.lower()
    hits = []
    for cat, terms in ip_terms.items():
        for t in terms:
            tl = t.lower()
            if tl in notes_l:
                hits.append({"category": cat, "term": t, "where": "rule"})
            elif tl in name_l:
                hits.append({"category": cat, "term": t, "where": "name"})
    return hits


def rule_one_line(sig: Signal) -> str:
    notes = sig.notes.strip()
    if not notes:
        return sig.name
    if "규칙:" in notes:
        notes = notes.split("규칙:", 1)[1].strip()
    notes = re.split(r"\.(?=\s|$)|[。\n]", notes, maxsplit=1)[0]  # 소수점은 자르지 않음
    return notes.strip() or sig.name


def ip_risks(sig: Signal, ip_terms: dict[str, list[str]]) -> list[str]:
    risks = []
    for h in find_ip_hits(sig, ip_terms):
        part = "규칙 일부" if h["where"] == "rule" else "이름만 겹침"
        risks.append(f"{CATEGORY_KO.get(h['category'], h['category'])} '{h['term']}' ({part})")
    risks.append("그림·이름·소리는 원작을 쓰지 말고 새로 제작")
    return risks


def new_skin(sig: Signal) -> str:
    return _SKINS[sum(ord(c) for c in sig.name) % len(_SKINS)]


def extract(sig: Signal, ip_terms: dict[str, Any]) -> dict[str, Any]:
    return {"rule_one_line": rule_one_line(sig),
            "new_skin": new_skin(sig),
            "ip_risks": ip_risks(sig, ip_terms)}
