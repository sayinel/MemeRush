"""제작 라인 3~5·7단계(production.py). Claude 호출은 가짜 클라이언트로 대신한다."""
import json
from types import SimpleNamespace

import pytest

from discovery import production as prod


class FakeClient:
    """client.beta.messages.create(...)만 흉내 낸다. 응답을 순서대로 돌려주고 요청을 기록한다."""

    def __init__(self, *payloads, stop_reason="end_turn"):
        self.payloads = list(payloads)
        self.calls = []
        self.stop_reason = stop_reason
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kw):
        self.calls.append(kw)
        text = json.dumps(self.payloads.pop(0)) if self.payloads else "{}"
        return SimpleNamespace(stop_reason=self.stop_reason, stop_details=None,
                               content=[SimpleNamespace(type="thinking", thinking=""),
                                        SimpleNamespace(type="text", text=text)])


COMBO = {
    "frame": "timing_stop", "meme": "Friday 5PM",
    "plan": {"id": "2026-10-25", "title": "MemeRush Daily #002", "frame": "timing_stop",
             "frameParams": {"rounds": 3, "targetMs": [3000, 4000, 5000], "visibleMs": 1500},
             "seed": "2026-10-25", "meme": {}},
}
MEME = {
    "name": "Friday 5PM", "type": "timing", "use_mode": "free", "ip_risks": [],
    "meme_context": {"summary": "Counting down to clocking out.", "since": "2026-09", "url": "https://ctx.example/a"},
    "background": {"summary": "Office workers post the last minute before 5PM.",
                   "sources": [{"name": "KnowYourMeme", "url": "https://kym.example/friday"}]},
    "reactions": [{"mood": "relatable", "summary": "People share their own escape stories.",
                   "source": {"name": "TikTok comments", "url": "https://tt.example/x"}}],
}
BRIEF_OUT = {"premise": "It is 4:59 on Friday.", "protagonist": "An orange office blob.",
             "twist": "Leave early and the boss sees you.", "mood": ["tense", "relief"],
             "laughPoint": "The boss blocks the clock.", "reactionNotes": ["People relate to the last minute."],
             "mustAvoid": ["real bosses"]}


def card(**over):
    c = {
        "title": "FRIDAY 5PM — CLOCK OUT", "prompt": "Clock out at exactly 5:00:00.",
        "theme": {"background": "office", "player": "worker", "boss": "boss", "goal": "door",
                  "rounds": [{"label": "THE EMAIL", "startLabel": "4:59:57", "hider": "email_pile"},
                             {"label": "THE MEETING", "startLabel": "4:59:56", "hider": "meeting_card"},
                             {"label": "THE BOSS", "startLabel": "4:59:55", "hider": "boss"}]},
        "hope": "{nearLabel}… ALMOST FREE",
        "win": {"top": "CLOCKED OUT {stopLabel}", "bottom": "WEEKEND UNLOCKED", "props": ["confetti"]},
        "lose": {"top": "SO CLOSE", "bottom": "{result}", "props": [],
                 "early": {"top": "TOO EARLY.", "bottom": "THE BOSS SAW YOU.", "props": ["boss_grab"]},
                 "late": {"top": "TOO LATE.", "bottom": "ONE MORE EMAIL.", "props": ["email"]}},
        "share": "{result} in FRIDAY 5PM. Beat me:",
    }
    c.update(over)
    return c


def test_ask_json_uses_current_model_fallbacks_and_schema():
    client = FakeClient({"ok": True})
    assert prod.ask_json(client, "sys", "hi", {"type": "object"}) == {"ok": True}
    kw = client.calls[0]
    assert kw["model"] == "claude-opus-5-5"
    assert kw["fallbacks"] == "default" and kw["betas"] == ["server-side-fallback-2026-07-01"]
    assert kw["output_config"]["format"]["type"] == "json_schema"
    assert "thinking" not in kw and "temperature" not in kw


def test_ask_json_refusal_and_truncation_raise():
    with pytest.raises(prod.ProductionError, match="거절"):
        prod.ask_json(FakeClient({}, stop_reason="refusal"), "s", "p", {})
    with pytest.raises(prod.ProductionError, match="max_tokens"):
        prod.ask_json(FakeClient({}, stop_reason="max_tokens"), "s", "p", {})


def test_brief_passes_research_and_keeps_sources():
    client = FakeClient(BRIEF_OUT)
    brief = prod.make_brief(COMBO, MEME, client)
    prompt = client.calls[0]["messages"][0]["content"]
    assert "Office workers post the last minute" in prompt and "escape stories" in prompt
    assert brief["challengeId"] == "2026-10-25" and brief["frame"] == "timing_stop"
    assert {"real people", "trademarks", "real bosses"} <= set(brief["mustAvoid"])
    assert [s["url"] for s in brief["sources"]] == ["https://kym.example/friday", "https://tt.example/x",
                                                    "https://ctx.example/a"]


def test_valid_card_passes():
    assert prod.validate_card(card(), rounds=3) == []


@pytest.mark.parametrize("over, needle", [
    ({"hope": "THIS LINE IS DEFINITELY WAY TOO LONG FOR A CAPTION"}, "max 30"),
    ({"win": {"top": "Clocked out", "bottom": "WEEKEND", "props": []}}, "UPPERCASE"),
    ({"win": {"top": "WOW!!", "bottom": "WEEKEND", "props": []}}, "more than one '!'"),
    ({"share": "Beat me 🔥 {result}"}, "emoji"),
    ({"share": "Beat my score"}, "must contain {result}"),
    ({"title": "MARIO CLOCKS OUT"}, "protected name"),
])
def test_card_rule_violations(over, needle):
    problems = prod.validate_card(card(**over), rounds=3)
    assert any(needle in p for p in problems), problems


def test_ip_terms_use_word_boundaries():
    # "ultrasonic"에는 "sonic"이 들어 있지만 상표 위반이 아니다
    assert prod.validate_card(card(prompt="An ultrasonic alarm goes off at 5."), rounds=3) == []


def test_round_count_mismatch():
    c = card()
    c["theme"]["rounds"] = c["theme"]["rounds"][:2]
    assert any("need 3" in p for p in prod.validate_card(c, rounds=3))


@pytest.mark.parametrize("label", ["6...7", "4:59", "T-3s", "4:59:57 PM"])
def test_start_label_must_be_a_clock(label):
    c = card()
    c["theme"]["rounds"][0]["startLabel"] = label
    assert any("startLabel must be a clock" in p for p in prod.validate_card(c, rounds=3))


def test_make_card_file_retries_once_with_feedback():
    bad = card(hope="this caption is lowercase")
    client = FakeClient({"options": [bad, card(), card()]}, {"options": [card(), card(), card()]})
    out = prod.make_card_file({**BRIEF_OUT, "meme": "Friday 5PM", "challengeId": "2026-10-25"}, COMBO, [], client)
    assert len(client.calls) == 2
    assert "option 1: hope must be UPPERCASE" in client.calls[1]["messages"][0]["content"]
    assert all(o["ok"] for o in out["options"])


def test_asset_requests_only_missing_keys():
    library = ["worker_smug", "worker_crying", "confetti"]
    c = card()
    c["theme"]["rounds"][0]["hider"] = "printer_jam"
    req = prod.asset_requests(c, {**BRIEF_OUT, "challengeId": "2026-10-25", "sources": []}, library)
    keys = {r["key"]: r["priority"] for r in req["requests"]}
    assert "worker" not in keys and "confetti" not in keys  # worker_* 그림이 있음
    assert keys["printer_jam"] == "P0"  # 코드가 대신 그릴 수 없는 새 그림
    assert keys["office"] == "P1"  # 코드가 대신 그리는 그림


def test_day_file_matches_app_shape():
    day = prod.day_file(card(), COMBO, MEME)
    assert set(day) == {"id", "title", "frame", "frameParams", "seed", "meme"}
    assert day["frameParams"]["targetMs"] == [3000, 4000, 5000]
    assert len(day["meme"]["theme"]["rounds"]) == day["frameParams"]["rounds"]
    assert day["meme"]["context"] == {"summary": "Counting down to clocking out.", "url": "https://ctx.example/a"}


def test_pick_option_refuses_cards_with_problems():
    with pytest.raises(prod.ProductionError, match="규칙 위반"):
        prod.pick_option({"options": [{"card": card(), "ok": False, "problems": ["x"]}]}, 1)


def test_library_rules_fix_player_and_cap_new_keys():
    c = card()
    c["theme"]["player"] = "student_pip"
    c["win"]["props"] = ["textbook", "backpack", "lunch_tray", "palms_scale"]
    problems = prod.library_problems(c, ["worker_smug"])
    assert any("theme.player must be 'worker'" in p for p in problems)
    assert any("new sprite keys (max 3)" in p for p in problems)
    assert prod.library_problems(card(), ["worker_smug"]) == []
