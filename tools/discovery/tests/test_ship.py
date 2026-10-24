import json

import pytest

from discovery import ship as sh
from discovery.production import ProductionError

DAY = json.load(open("../../web/content/challenges/2026-10-24.json", encoding="utf-8"))


class FakeGh:
    """gh 호출을 기록하고, 빌드 상태는 정해 둔 순서대로 돌려준다."""

    def __init__(self, build_states=("pending", "success"), existing_sha=""):
        self.calls, self.build_states, self.existing_sha = [], list(build_states), existing_sha

    def __call__(self, args):
        self.calls.append(args)
        joined = " ".join(args)
        if "git/ref/heads/main" in joined:
            return "basesha\n"
        if args[:3] == ["api", "-X", "POST"]:
            return "{}"
        if "/contents/" in joined and "-X" not in args:
            if not self.existing_sha:
                raise ProductionError("404")
            return self.existing_sha
        if args[:3] == ["api", "-X", "PUT"]:
            return json.dumps({"commit": {"sha": "headsha"}})
        if args[:2] == ["pr", "create"]:
            return "https://github.com/o/r/pull/99\n"
        if "commits/headsha/status" in joined:
            return self.build_states.pop(0) if len(self.build_states) > 1 else self.build_states[0]
        if args[:2] == ["pr", "merge"]:
            return ""
        raise AssertionError(f"unexpected gh call: {args}")


def write_day(tmp_path, day=DAY, name="2026-10-24"):
    f = tmp_path / f"{name}.json"
    f.write_text(json.dumps(day), encoding="utf-8")
    return f


def test_ship_goes_from_pr_to_live(tmp_path):
    gh = FakeGh()
    seen = iter([None, {"title": "old"}, {"title": DAY["title"]}])
    state = sh.ship(write_day(tmp_path), "o/r", "https://prod.example", tmp_path / "ship.json",
                    gh=gh, fetch=lambda url: next(seen), sleep=lambda s: None)
    assert state["liveUrl"] == "https://prod.example/c/2026-10-24"
    assert state["prUrl"] == "https://github.com/o/r/pull/99"
    assert all(v == "done" for v in state["steps"].values())
    assert json.loads((tmp_path / "ship.json").read_text())["steps"]["live"] == "done"
    put = next(c for c in gh.calls if c[:3] == ["api", "-X", "PUT"])
    assert not any(a.startswith("sha=") for a in put)  # 새 파일
    merge_at = next(i for i, c in enumerate(gh.calls) if c[:2] == ["pr", "merge"])
    build_at = max(i for i, c in enumerate(gh.calls) if "commits/headsha/status" in " ".join(c))
    assert build_at < merge_at  # 빌드 검사가 통과한 뒤에만 머지


def test_failed_build_stops_before_merge(tmp_path):
    gh = FakeGh(build_states=("pending", "failure"))
    with pytest.raises(ProductionError, match="Vercel"):
        sh.ship(write_day(tmp_path), "o/r", "https://prod.example", tmp_path / "ship.json",
                gh=gh, fetch=lambda url: None, sleep=lambda s: None)
    assert not any(c[:2] == ["pr", "merge"] for c in gh.calls)
    state = json.loads((tmp_path / "ship.json").read_text())
    assert state["steps"]["build"] == "error" and "Vercel" in state["error"]


def test_republishing_a_date_overwrites_with_sha(tmp_path):
    gh = FakeGh(build_states=("success",), existing_sha="oldsha\n")
    sh.ship(write_day(tmp_path), "o/r", "https://prod.example", None, gh=gh,
            fetch=lambda url: {"title": DAY["title"]}, sleep=lambda s: None)
    put = next(c for c in gh.calls if c[:3] == ["api", "-X", "PUT"])
    assert "sha=oldsha" in put


def test_bad_day_file_never_reaches_github(tmp_path):
    bad = {**DAY, "id": "2026-10-25"}
    gh = FakeGh()
    with pytest.raises(ProductionError, match="does not match"):
        sh.ship(write_day(tmp_path, bad), "o/r", "https://prod.example", tmp_path / "ship.json",
                gh=gh, fetch=lambda url: None, sleep=lambda s: None)
    assert gh.calls == []


def test_deploy_timeout_is_reported(tmp_path):
    with pytest.raises(ProductionError, match="프로덕션 배포"):
        sh.ship(write_day(tmp_path), "o/r", "https://prod.example", None, gh=FakeGh(build_states=("success",)),
                fetch=lambda url: None, sleep=lambda s: None, live_timeout_s=10, every_s=5)


def test_library_only_rejects_any_new_key():
    from discovery import production as prod
    card = {"theme": {"background": "office", "player": "worker", "boss": "boss", "goal": "door",
                      "rounds": [{"label": "A", "startLabel": "4:59:57", "hider": "dalgona_tin"}]},
            "win": {"props": []}, "lose": {"props": [], "early": {"props": []}, "late": {"props": []}}}
    assert prod.library_problems(card, ["worker_smug"]) == []
    assert any("max 0" in p for p in prod.library_problems(card, ["worker_smug"], max_new=0))


LIB = ["worker_smug", "bg_office", "email_pile", "meeting_card", "door", "duck", "trophy"]


def _card(background="office", hiders=("email_pile", "boss", "duck")):
    return {"theme": {"background": background, "player": "worker", "boss": "boss", "goal": "door",
                      "rounds": [{"label": "A", "startLabel": "4:59:57", "hider": h} for h in hiders]},
            "win": {"props": []}, "lose": {"props": [], "early": {"props": []}, "late": {"props": []}}}


def test_background_is_a_scene_name_not_a_file_key():
    from discovery import production as prod
    assert any("without 'bg_'" in p for p in prod.library_problems(_card("bg_office"), LIB))
    assert prod.library_problems(_card(), LIB, max_new=0) == []


def test_library_only_hiders_must_have_an_image():
    from discovery import production as prod
    problems = prod.library_problems(_card(hiders=("calendar", "boss", "duck")), LIB, max_new=0)
    assert any("rounds[0].hider 'calendar' has no image" in p for p in problems)


def test_library_only_goal_is_a_stage_prop_not_ui():
    from discovery import production as prod
    card = _card()
    card["theme"]["goal"] = "clock_button"
    problems = prod.library_problems(card, LIB + ["clock_button"], max_new=0)
    assert any("theme.goal 'clock_button' is not a stage prop" in p for p in problems)
