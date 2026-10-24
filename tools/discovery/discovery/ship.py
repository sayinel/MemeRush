"""9단계: 저장된 하루 판을 프로덕션에 올린다 (docs/AUTO_GAME_GENERATION_SCENARIO.md 3절 8·9단계).

어드민의 Publish 버튼이 사람의 승인이다. 그 뒤는 자동:
PR 만들기 → Vercel 빌드 검사(하루 판 zod 검증 포함) 통과 기다리기 → 머지 → 프로덕션에 새 판이 열릴 때까지 확인.
GitHub에는 `gh api`로 파일을 바로 올려서 시연 노트북의 작업 폴더(브랜치, 바뀐 파일)를 건드리지 않는다.
진행 상황은 한 줄씩 출력하고 `ship.json`에 단계별로 남겨 어드민이 읽게 한다.
"""

from __future__ import annotations

import base64
import json
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable, Optional

from .production import ProductionError, validate_card

DAY_PATH = "web/content/challenges/{id}.json"
STEPS = ("check", "pr", "build", "merge", "deploy", "live")

Gh = Callable[[list[str]], str]
Fetch = Callable[[str], Optional[dict[str, Any]]]


def gh_cli(args: list[str]) -> str:
    r = subprocess.run(["gh", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise ProductionError(f"gh {' '.join(args[:2])} 실패: {(r.stderr or r.stdout).strip()[:300]}")
    return r.stdout


def http_json(url: str) -> Optional[dict[str, Any]]:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Cache-Control": "no-cache"}), timeout=10) as r:
            return json.loads(r.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None


class Progress:
    """단계 상태를 ship.json에 쓴다: waiting → running → done | error."""

    def __init__(self, path: Optional[Path], day_id: str):
        self.path = path
        self.state: dict[str, Any] = {"challengeId": day_id, "steps": {s: "waiting" for s in STEPS},
                                      "prUrl": None, "liveUrl": None, "error": None}

    def set(self, step: str, status: str, **extra: Any) -> None:
        self.state["steps"][step] = status
        self.state.update(extra)
        print(f"[{step}] {status}" + "".join(f" {k}={v}" for k, v in extra.items() if v), flush=True)
        if self.path:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")


def check_day(day: dict[str, Any], day_id: str) -> list[str]:
    """올리기 전 빠른 검사. 최종 검증은 Vercel 빌드의 zod 스키마(web/src/lib/challenge.ts)가 한다."""
    problems = []
    if day.get("id") != day_id:
        problems.append(f"id {day.get('id')!r} does not match the file name {day_id}")
    if day.get("frame") != "timing_stop":
        problems.append(f"frame must be timing_stop, got {day.get('frame')!r}")
    meme = day.get("meme") or {}
    try:
        card = {"title": day["title"], **meme}
        problems += validate_card(card, int(day["frameParams"]["rounds"]))
    except (KeyError, TypeError, ValueError) as e:
        problems.append(f"missing field: {e}")
    return problems


def _wait(what: str, probe: Callable[[], Optional[bool]], timeout_s: float, every_s: float,
          sleep: Callable[[float], None]) -> None:
    """probe가 True면 끝, False면 실패, None이면 계속 기다린다."""
    waited = 0.0
    while waited <= timeout_s:
        r = probe()
        if r is True:
            return
        if r is False:
            raise ProductionError(f"{what} 실패")
        sleep(every_s)
        waited += every_s
    raise ProductionError(f"{what}: {int(timeout_s)}초 안에 끝나지 않았습니다")


def ship(day_file: Path, repo: str, prod_url: str, status_path: Optional[Path] = None, base: str = "main",
         gh: Gh = gh_cli, fetch: Fetch = http_json, sleep: Callable[[float], None] = time.sleep,
         build_timeout_s: float = 300, live_timeout_s: float = 300, every_s: float = 5) -> dict[str, Any]:
    day_id = day_file.stem
    p = Progress(status_path, day_id)
    step = "check"
    try:
        p.set(step, "running")
        if not day_file.exists():
            raise ProductionError(f"하루 판 파일이 없습니다: {day_file}")
        text = day_file.read_text(encoding="utf-8")
        day = json.loads(text)
        problems = check_day(day, day_id)
        if problems:
            raise ProductionError("하루 판 검사 실패: " + "; ".join(problems))
        p.set(step, "done")

        step = "pr"
        p.set(step, "running")
        # 시각을 붙여 다시 실행해도 이전 실패의 브랜치와 부딪히지 않게 한다.
        branch = f"content/{day_id}-{time.strftime('%H%M%S')}"
        path = DAY_PATH.format(id=day_id)
        base_sha = gh(["api", f"repos/{repo}/git/ref/heads/{base}", "--jq", ".object.sha"]).strip()
        gh(["api", "-X", "POST", f"repos/{repo}/git/refs", "-f", f"ref=refs/heads/{branch}", "-f", f"sha={base_sha}"])
        put = ["api", "-X", "PUT", f"repos/{repo}/contents/{path}", "-f", f"message=content: {day_id} 오늘의 게임 {day['title']}",
               "-f", f"content={base64.b64encode(text.encode('utf-8')).decode()}", "-f", f"branch={branch}"]
        existing = _file_sha(gh, repo, path, branch)
        if existing:
            put += ["-f", f"sha={existing}"]  # 같은 날짜를 다시 발행하면 덮어쓴다
        head_sha = json.loads(gh(put))["commit"]["sha"]
        body = (f"어드민 Publish로 자동 생성된 하루 판입니다.\n\n- 날짜: {day_id}\n- 제목: {day['title']}\n- 밈: {day['meme']['name']}\n\n"
                "Vercel 빌드(하루 판 zod 검증 포함)가 통과하면 자동으로 머지됩니다.")
        pr_url = gh(["pr", "create", "--repo", repo, "--base", base, "--head", branch,
                     "--title", f"content: {day_id} {day['title']}", "--body", body]).strip()
        p.set(step, "done", prUrl=pr_url)

        step = "build"
        p.set(step, "running")

        def build_state() -> Optional[bool]:
            state = gh(["api", f"repos/{repo}/commits/{head_sha}/status", "--jq", ".state"]).strip()
            return True if state == "success" else False if state in ("failure", "error") else None

        _wait("Vercel 빌드 검사", build_state, build_timeout_s, every_s, sleep)
        p.set(step, "done")

        step = "merge"
        p.set(step, "running")
        gh(["pr", "merge", pr_url, "--repo", repo, "--merge", "--delete-branch"])
        p.set(step, "done")

        step = "deploy"
        p.set(step, "running")
        api_url = f"{prod_url.rstrip('/')}/api/challenges/{day_id}"

        def live() -> Optional[bool]:
            got = fetch(api_url)
            return True if got and got.get("title") == day["title"] else None

        _wait("프로덕션 배포", live, live_timeout_s, every_s, sleep)
        p.set(step, "done")

        live_url = f"{prod_url.rstrip('/')}/c/{day_id}"
        p.set("live", "done", liveUrl=live_url)
        return p.state
    except ProductionError as e:
        p.set(step, "error", error=str(e))
        raise


def _file_sha(gh: Gh, repo: str, path: str, ref: str) -> str:
    """브랜치에 이미 있는 파일의 sha(덮어쓸 때 필요). 없으면 빈 문자열."""
    try:
        return gh(["api", f"repos/{repo}/contents/{path}?ref={ref}", "--jq", ".sha"]).strip()
    except ProductionError:
        return ""
