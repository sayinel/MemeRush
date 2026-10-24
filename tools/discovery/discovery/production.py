"""오늘의 게임 제작 라인 3~5단계와 7단계 준비 (docs/CONTENT_PRODUCTION_LINE.md).

3 brief   : 고른 조합(combos.json) + 밈 조사(memes.json의 background·reactions) → story_brief.json
4 card    : 브리프 → 밈 카드 후보 3개(card.json). 작성 규칙으로 검사한다.
5 assets  : 고른 카드가 쓰는 그림 중 라이브러리(manifest.json)에 없는 것 → asset_requests.json
7 publish : 고른 카드 → 앱의 하루 판 파일(GAME_FRAME_SPEC 6절 + MEME_GAME_DESIGN 6절)

3·4단계는 Claude API로 쓴다. 사람이 고르고 승인한 뒤에만 앱에 들어간다(MEME_GAME_DESIGN 7절).
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Callable, Optional

MODEL = "claude-opus-5-5"
CARD_OPTIONS = 3
CAPTION_MAX = 30  # WRITING_GUIDE 3절
PROMPT_MAX = 80
SHARE_MAX = 80

# 게임이 이미 그림이나 코드로 그릴 수 있는 키(web/public/game/manifest.json에 없어도 요청하지 않는다).
# 사람이 고를 때 참고하도록 카드 생성 프롬프트에도 그대로 보여 준다.
MAX_NEW_KEYS = 3  # 하루 판에 새로 그려야 하는 그림 상한(핏 작업량)
PLAYER_KEY = "worker"  # 확정 주인공: art/character-champion (주황 블롭 + 빨간 넥타이)

CODE_DRAWN_KEYS = ("office", "worker", "boss", "door", "email_pile", "meeting_card", "confetti", "email", "calendar")

IP_TERMS_PATH = Path(__file__).with_name("ip_terms.json")


class ProductionError(RuntimeError):
    pass


# ---------- Claude 호출 ----------

def _client():
    import anthropic  # 지연 import: 시험은 가짜 클라이언트를 넣는다
    return anthropic.Anthropic()


def ask_json(client: Any, system: str, prompt: str, schema: dict[str, Any]) -> dict[str, Any]:
    """구조화 출력(JSON 스키마)으로 한 번 묻는다. 거절이면 서버가 다른 모델로 이어받는다(fallbacks)."""
    resp = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "high", "format": {"type": "json_schema", "schema": schema}},
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    if resp.stop_reason == "refusal":
        reason = getattr(resp.stop_details, "explanation", None) if resp.stop_details else None
        raise ProductionError(f"모델이 거절했습니다: {reason or '사유 없음'}")
    if resp.stop_reason == "max_tokens":
        raise ProductionError("출력이 max_tokens에서 잘렸습니다")
    text = next((b.text for b in resp.content if b.type == "text"), None)
    if text is None:
        raise ProductionError("응답에 텍스트 블록이 없습니다")
    return json.loads(text)


# ---------- 3. 스토리 브리프 ----------

BRIEF_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "premise": {"type": "string", "description": "One sentence: the situation the player is in."},
        "protagonist": {"type": "string", "description": "Who the player is (an original character, never a real person)."},
        "twist": {"type": "string", "description": "One line: what goes wrong when you mistime it."},
        "mood": {"type": "array", "items": {"type": "string"}, "description": "2-4 mood words."},
        "laughPoint": {"type": "string", "description": "Where the laugh comes from in this game."},
        "reactionNotes": {"type": "array", "items": {"type": "string"},
                          "description": "Short paraphrased notes on how people react to the meme (no quotes, no usernames)."},
        "mustAvoid": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["premise", "protagonist", "twist", "mood", "laughPoint", "reactionNotes", "mustAvoid"],
    "additionalProperties": False,
}

BRIEF_SYSTEM = """You write story briefs for Meme Rush, a daily 30-second web game that turns a trending meme into a playable moment.
Rules you must follow:
- Take only the meme's format, phrase, number or moment. Never use the original meme image, its characters, real people, trademarks or songs.
- No mockery of specific people, no hate, no drugs or sexual hints. Failure jokes are only at the player's own character.
- The protagonist is an original character. Keep everything short and concrete."""


def brief_context(combo: dict[str, Any], meme: dict[str, Any]) -> dict[str, Any]:
    """브리프 입력(결정적). 모델에 넘길 사실만 고른다."""
    plan = combo["plan"]
    return {
        "challengeId": plan["id"],
        "frame": combo["frame"],
        "frameParams": plan["frameParams"],
        "meme": {
            "name": meme["name"], "type": meme["type"],
            "context": meme.get("meme_context", {}),
            "background": meme.get("background") or {},
            "reactions": meme.get("reactions") or [],
            "useMode": meme.get("use_mode"),
            "ipRisks": meme.get("ip_risks") or [],
        },
    }


def make_brief(combo: dict[str, Any], meme: dict[str, Any], client: Any) -> dict[str, Any]:
    ctx = brief_context(combo, meme)
    prompt = (
        "Write the story brief for today's game.\n"
        f"Frame: {ctx['frame']} (the player taps once per round to stop a hidden timer at the target time; "
        f"{ctx['frameParams'].get('rounds', 3)} rounds, targets {ctx['frameParams'].get('targetMs')} ms).\n"
        f"Research about the meme (facts and paraphrased reactions with sources):\n{json.dumps(ctx['meme'], ensure_ascii=False, indent=2)}"
    )
    data = ask_json(client, BRIEF_SYSTEM, prompt, BRIEF_SCHEMA)
    must = sorted(set(data.get("mustAvoid", [])) | {"original meme image", "real people", "trademarks", "songs"})
    return {"challengeId": ctx["challengeId"], "meme": meme["name"], "frame": combo["frame"],
            **data, "mustAvoid": must,
            "sources": _sources(meme)}


def _sources(meme: dict[str, Any]) -> list[dict[str, str]]:
    out = []
    bg = meme.get("background") or {}
    for s in bg.get("sources", []) or []:
        if isinstance(s, dict) and s.get("url"):
            out.append({"name": str(s.get("name", "")), "url": str(s["url"])})
    for r in meme.get("reactions") or []:
        src = r.get("source") if isinstance(r, dict) else None
        if isinstance(src, dict) and src.get("url"):
            out.append({"name": str(src.get("name", "")), "url": str(src["url"])})
    ctx_url = (meme.get("meme_context") or {}).get("url")
    if ctx_url:
        out.append({"name": "meme_context", "url": str(ctx_url)})
    seen, uniq = set(), []
    for s in out:
        if s["url"] not in seen:
            seen.add(s["url"])
            uniq.append(s)
    return uniq


# ---------- 4. 카드 문구 ----------

_CAPTION = {"type": "object", "properties": {"top": {"type": "string"}, "bottom": {"type": "string"},
                                              "props": {"type": "array", "items": {"type": "string"}}},
            "required": ["top", "bottom", "props"], "additionalProperties": False}

CARD_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "options": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "prompt": {"type": "string"},
                    "theme": {
                        "type": "object",
                        "properties": {
                            "background": {"type": "string"}, "player": {"type": "string"},
                            "boss": {"type": "string"}, "goal": {"type": "string"},
                            "rounds": {"type": "array", "items": {
                                "type": "object",
                                "properties": {"label": {"type": "string"}, "startLabel": {"type": "string"},
                                               "hider": {"type": "string"}},
                                "required": ["label", "startLabel", "hider"], "additionalProperties": False}},
                        },
                        "required": ["background", "player", "boss", "goal", "rounds"],
                        "additionalProperties": False,
                    },
                    "hope": {"type": "string"},
                    "win": _CAPTION,
                    "lose": {"type": "object", "properties": {
                        "top": {"type": "string"}, "bottom": {"type": "string"},
                        "props": {"type": "array", "items": {"type": "string"}},
                        "early": _CAPTION, "late": _CAPTION},
                        "required": ["top", "bottom", "props", "early", "late"], "additionalProperties": False},
                    "share": {"type": "string"},
                },
                "required": ["title", "prompt", "theme", "hope", "win", "lose", "share"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["options"],
    "additionalProperties": False,
}

CARD_SYSTEM = """You write meme cards for Meme Rush (English only). Voice: a friend teasing you with a dry one-liner.
Captions: two lines, top = situation/twist, bottom = result/punch. UPPERCASE. Each line 30 characters or fewer including spaces.
One idea per line. No emoji, no hashtags. Numbers carry units (0.087S). At most one "!" per caption.
Never blame the player ("You failed"); losing lines invite one more try.
Take only the meme's format, phrase, number or moment - never the original image, characters, real people, trademarks or songs.
The player is always the Meme Rush mascot (theme.player = "worker": an orange blob with a red tie). Put him into the meme's situation instead of inventing a new protagonist; use his existing expression sprites (worker_*) for reactions.
Sprite keys must be lowercase snake_case. Prefer the existing keys you are given; at most 3 new keys per card, only when the story needs them."""

PLACEHOLDERS = ("{result}", "{stopLabel}", "{nearLabel}", "{error}")


def make_cards(brief: dict[str, Any], combo: dict[str, Any], library: list[str], client: Any,
               feedback: Optional[list[str]] = None) -> list[dict[str, Any]]:
    params = combo["plan"]["frameParams"]
    rounds = int(params.get("rounds", 3))
    prompt = (
        f"Write {CARD_OPTIONS} different meme card options for today's game.\n"
        f"Story brief:\n{json.dumps(brief, ensure_ascii=False, indent=2)}\n\n"
        f"Game: frame {combo['frame']}, {rounds} rounds, round targets {params.get('targetMs')} ms. "
        f"Each round has a label (UPPERCASE, <=30 chars), a clock startLabel shown before it hides (<=10 chars), "
        f"and a hider sprite key that covers the clock. theme.rounds must have exactly {rounds} items.\n"
        "win = Perfect; lose.early = tapped too early; lose.late = tapped too late; lose.top/bottom = generic loss.\n"
        f"Placeholders you may use: {', '.join(PLACEHOLDERS)} ({{result}} renders like '0.087s off').\n"
        f"hope: <=30 chars, UPPERCASE, shown just before the final round. prompt: <={PROMPT_MAX} chars, sentence case. "
        f"share: <={SHARE_MAX} chars, must contain {{result}}, no nickname, never reveals the target time.\n"
        f"Existing sprite keys: {', '.join(sorted(set(library) | set(CODE_DRAWN_KEYS)))}."
    )
    if feedback:
        prompt += "\n\nYour previous options broke these rules - fix them:\n- " + "\n- ".join(feedback)
    return ask_json(client, CARD_SYSTEM, prompt, CARD_SCHEMA)["options"]


def _ip_terms() -> list[str]:
    data = json.loads(IP_TERMS_PATH.read_text(encoding="utf-8"))
    return [t for terms in data.values() for t in terms]


def _has_emoji(s: str) -> bool:
    return any(unicodedata.category(ch) == "So" or ord(ch) > 0x2FFF for ch in s)


def _render(s: str) -> str:
    """길이 검사용: 자리표시자를 대표 길이 값으로 바꾼다."""
    return (s.replace("{result}", "0.087s off").replace("{stopLabel}", "5:00:00.03")
             .replace("{nearLabel}", "4:59:55").replace("{error}", "0.087"))


def validate_card(card: dict[str, Any], rounds: int) -> list[str]:
    """WRITING_GUIDE 2~3·6·8절과 MEME_GAME_DESIGN 6절 규칙. 위반 목록(비어 있으면 통과)."""
    problems: list[str] = []
    captions: list[tuple[str, str]] = [("hope", card["hope"]), ("win.top", card["win"]["top"]),
                                       ("win.bottom", card["win"]["bottom"]),
                                       ("lose.top", card["lose"]["top"]), ("lose.bottom", card["lose"]["bottom"])]
    for v in ("early", "late"):
        captions += [(f"lose.{v}.top", card["lose"][v]["top"]), (f"lose.{v}.bottom", card["lose"][v]["bottom"])]
    captions += [(f"rounds[{i}].label", r["label"]) for i, r in enumerate(card["theme"]["rounds"])]
    for name, text in captions:
        rendered = _render(text)
        if len(rendered) > CAPTION_MAX:
            problems.append(f"{name} is {len(rendered)} chars (max {CAPTION_MAX}): {text!r}")
        if re.sub(r"\{[a-zA-Z]+\}", "", text) != re.sub(r"\{[a-zA-Z]+\}", "", text).upper():
            problems.append(f"{name} must be UPPERCASE: {text!r}")
        if text.count("!") > 1:
            problems.append(f"{name} has more than one '!': {text!r}")
    for name, text in captions + [("prompt", card["prompt"]), ("share", card["share"]), ("title", card["title"])]:
        if _has_emoji(text) or "#" in text:
            problems.append(f"{name} has emoji or hashtag: {text!r}")
    if len(card["title"]) > CAPTION_MAX:
        problems.append(f"title is {len(card['title'])} chars (max {CAPTION_MAX})")
    if len(card["prompt"]) > PROMPT_MAX:
        problems.append(f"prompt is {len(card['prompt'])} chars (max {PROMPT_MAX})")
    if "{result}" not in card["share"] or len(_render(card["share"])) > SHARE_MAX:
        problems.append(f"share must contain {{result}} and be <= {SHARE_MAX} chars: {card['share']!r}")
    if len(card["theme"]["rounds"]) != rounds:
        problems.append(f"theme.rounds has {len(card['theme']['rounds'])} items, need {rounds}")
    for i, r in enumerate(card["theme"]["rounds"]):
        if len(r["startLabel"]) > 10:
            problems.append(f"rounds[{i}].startLabel longer than 10 chars: {r['startLabel']!r}")
    blob = json.dumps(card, ensure_ascii=False).lower()
    for term in _ip_terms():
        pattern = rf"\b{re.escape(term.lower())}\b" if term.isascii() else re.escape(term)
        if re.search(pattern, blob):
            problems.append(f"uses a protected name: {term!r}")
    for key in sprite_keys(card):
        if not re.fullmatch(r"[a-z][a-z0-9_]*", key):
            problems.append(f"sprite key must be lowercase snake_case: {key!r}")
    return problems


def library_problems(card: dict[str, Any], library: list[str]) -> list[str]:
    """그림 라이브러리 기준 규칙: 확정 주인공, 새 그림 키 상한."""
    problems = []
    if card["theme"]["player"] != PLAYER_KEY:
        problems.append(f"theme.player must be {PLAYER_KEY!r} (the confirmed mascot), got {card['theme']['player']!r}")
    new = [k for k in sprite_keys(card) if not _covered(k, library) and k not in CODE_DRAWN_KEYS]
    if len(new) > MAX_NEW_KEYS:
        problems.append(f"{len(new)} new sprite keys (max {MAX_NEW_KEYS}): {', '.join(new)}")
    return problems


def make_card_file(brief: dict[str, Any], combo: dict[str, Any], library: list[str], client: Any) -> dict[str, Any]:
    """후보 3개를 만들고 검사한다. 위반이 있으면 한 번만 다시 쓰게 한다."""
    rounds = int(combo["plan"]["frameParams"].get("rounds", 3))
    check = lambda o: validate_card(o, rounds) + library_problems(o, library)
    options = make_cards(brief, combo, library, client)
    problems = [check(o) for o in options]
    if any(problems):
        flat = [f"option {i + 1}: {p}" for i, ps in enumerate(problems) for p in ps]
        options = make_cards(brief, combo, library, client, feedback=flat)
        problems = [check(o) for o in options]
    return {"challengeId": combo["plan"]["id"], "frame": combo["frame"], "meme": brief["meme"],
            "options": [{"index": i + 1, "card": o, "problems": p, "ok": not p}
                        for i, (o, p) in enumerate(zip(options, problems))]}


# ---------- 5. 에셋 요청 ----------

def sprite_keys(card: dict[str, Any]) -> list[str]:
    t = card["theme"]
    keys = [t["background"], t["player"], t["boss"], t["goal"]] + [r["hider"] for r in t["rounds"]]
    keys += card["win"]["props"] + card["lose"]["props"]
    for v in ("early", "late"):
        keys += card["lose"][v]["props"]
    seen, out = set(), []
    for k in keys:
        if k and k not in seen:
            seen.add(k)
            out.append(k)
    return out


def load_library(manifest: Path) -> list[str]:
    if not manifest.exists():
        raise ProductionError(f"그림 목록을 찾지 못했습니다: {manifest}")
    return list(json.loads(manifest.read_text(encoding="utf-8")).keys())


def _covered(key: str, library: list[str]) -> bool:
    # worker → worker_smug 같은 동작별 그림이 있으면 갖춘 것으로 본다
    return key in library or any(k.startswith(key + "_") for k in library)


def asset_requests(card: dict[str, Any], brief: dict[str, Any], library: list[str]) -> dict[str, Any]:
    missing = [k for k in sprite_keys(card) if not _covered(k, library)]
    drawn = [k for k in missing if k in CODE_DRAWN_KEYS]
    return {
        "challengeId": brief["challengeId"],
        "style": "art/champion/README.md",
        "brief": {k: brief[k] for k in ("premise", "protagonist", "twist", "mood", "laughPoint", "mustAvoid")},
        "sources": brief.get("sources", []),
        "requests": [{"key": k, "file": f"web/public/game/{k}.png",
                      "priority": "P1" if k in drawn else "P0",
                      "note": "game draws a stand-in in code until this arrives" if k in drawn else "no stand-in yet"}
                     for k in missing],
        "rules": ["transparent PNG 768x768 (1024 for large), white sticker outline + brown inner line",
                  "no text or numbers in the image", "no real people, original meme characters, or trademarks",
                  "add a line to web/public/game/manifest.json"],
    }


# ---------- 7. 하루 판 파일 ----------

def day_file(card: dict[str, Any], combo: dict[str, Any], meme: dict[str, Any]) -> dict[str, Any]:
    plan = combo["plan"]
    ctx = meme.get("meme_context") or {}
    return {
        "id": plan["id"], "title": card["title"], "frame": plan["frame"],
        "frameParams": plan["frameParams"], "seed": plan["seed"],
        "meme": {
            "name": meme["name"],
            "context": {"summary": str(ctx.get("summary", "")), "url": str(ctx.get("url", ""))},
            "prompt": card["prompt"], "theme": card["theme"], "hope": card["hope"],
            "win": card["win"], "lose": card["lose"], "share": card["share"],
        },
    }


# ---------- 파일 입출력 도우미 ----------

def read_json(path: Path) -> Any:
    if not path.exists():
        raise ProductionError(f"파일이 없습니다: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def pick_combo(out: Path, index: int) -> tuple[dict[str, Any], dict[str, Any]]:
    combos = read_json(out / "combos.json")
    if not 1 <= index <= len(combos):
        raise ProductionError(f"조합 번호는 1~{len(combos)} 중 하나입니다")
    combo = combos[index - 1]
    memes = {m["name"]: m for m in read_json(out / "memes.json")}
    if combo["meme"] not in memes:
        raise ProductionError(f"memes.json에 '{combo['meme']}'가 없습니다. run을 다시 돌리세요")
    return combo, memes[combo["meme"]]


def pick_option(card_file: dict[str, Any], index: int) -> dict[str, Any]:
    opts = card_file["options"]
    if not 1 <= index <= len(opts):
        raise ProductionError(f"카드 번호는 1~{len(opts)} 중 하나입니다")
    opt = opts[index - 1]
    if not opt["ok"]:
        raise ProductionError("규칙 위반이 남은 카드입니다: " + "; ".join(opt["problems"]))
    return opt["card"]


ClientFactory = Callable[[], Any]
