"""입력(Signal)과 출력(Candidate) 데이터 모양. 필드는 GAME_DISCOVERY_PLAN.md 그대로."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any

from .evidence import is_sample, normalize_evidence, truthy
from .frames import guess_frame


@dataclass
class Signal:
    name: str
    url: str
    source: str
    metrics: dict[str, Any] = field(default_factory=dict)
    measured_at: str = ""
    notes: str = ""
    # 선택 필드(설계 이탈, PROGRESS.md 참고)
    traits: dict[str, Any] = field(default_factory=dict)
    sim: dict[str, Any] | None = None  # 오프라인 시연용 링크 응답 흉내
    # 인기 근거(없으면 빈 값). 옛 popularity_evidence는 읽을 때 online으로 변환된다.
    online: list[dict[str, Any]] = field(default_factory=list)
    community: list[dict[str, Any]] = field(default_factory=list)
    fading: bool = False              # 시들해지는 신호
    astroturf_suspect: bool = False   # 인위적 바이럴 의심
    meme_context: dict[str, Any] = field(default_factory=dict)  # summary, since, url
    sample: bool = False              # 가상(샘플) 자료 표시
    needs_review: bool = False        # ingest가 못 읽은 항목
    review_reasons: list[str] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)  # 정규화 중 알린 사항
    frame_guess: str | None = None    # 가장 가까운 틀 id(frames.py). 없으면 None
    frame_reason: str = ""

    @property
    def inferred(self) -> bool:
        return bool(self.traits.get("inferred"))

    @classmethod
    def from_dict(cls, d: dict[str, Any], sample: bool = False) -> "Signal":
        online, community, issues = normalize_evidence(d)
        if "frame_guess" in d:
            frame = d.get("frame_guess")
        else:  # 옛 입력: notes의 규칙 글에서 추정(탈락에는 쓰지 않음)
            frame = guess_frame(str(d.get("notes") or ""))[0]
        return cls(
            frame_guess=frame, frame_reason=str(d.get("frame_reason") or ""),
            name=d["name"],
            url=d.get("url", ""),
            source=d.get("source", ""),
            metrics=dict(d.get("metrics") or {}),
            measured_at=d.get("measured_at", ""),
            notes=d.get("notes", ""),
            traits=dict(d.get("traits") or {}),
            sim=d.get("sim"),
            online=online, community=community,
            fading=truthy(d.get("fading")),
            astroturf_suspect=truthy(d.get("astroturf_suspect")),
            meme_context=dict(d.get("meme_context") or {}),
            sample=sample or is_sample(d.get("_note")),
            needs_review=truthy(d.get("needs_review")),
            review_reasons=list(d.get("review_reasons") or []),
            issues=issues,
        )


@dataclass
class Candidate:
    rank: int
    name: str
    score: float
    rule_one_line: str
    session_length: int | float | None
    controls: list[str]
    score_type: str
    new_skin: str
    ip_risks: list[str]
    link_status: str
    evidence_url: str
    picked: bool = False
    online: list[dict[str, Any]] = field(default_factory=list)
    community: list[dict[str, Any]] = field(default_factory=list)
    fading: bool = False
    astroturf_suspect: bool = False
    popularity_total: float = 0.0
    popularity_scores: dict[str, float] = field(default_factory=dict)  # online, community, consensus_factor, ... total
    popularity_notes: dict[str, str] = field(default_factory=dict)
    consensus: dict[str, Any] = field(default_factory=dict)
    link_info: dict[str, Any] = field(default_factory=dict)  # 정보 표시용. 점수·탈락에 쓰지 않음
    meme_context: dict[str, Any] = field(default_factory=dict)
    background_line: str = ""
    sample: bool = False
    frame: str | None = None          # 연결된 틀 id
    frame_reason: str = ""
    inferred: bool = False            # traits가 추론값
    confidence: str = "보통"          # 추론값이면 "낮음(추론값)"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
