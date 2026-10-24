# 밈 카드 생성기 설계 (2026-10-24 초안)

발굴 로직(`meme-rush-discovery`)의 마지막 단계. 오늘의 조합 1개를 받아 하루 판 JSON(카드 포함) 후보 3개와 에셋 요청 목록을 낸다. 사장님이 후보 1개를 고르면 확정된다. 앱 안에서는 돌지 않는다(MVP_SCOPE 2절 "AI").

- 카드 형식 정본: MEME_GAME_DESIGN.md **6절**(요청서의 "4절"은 첫 게임 예시라 6절 형식을 따름). 하루 판 형식: GAME_FRAME_SPEC.md 6절.
- 결과 컷은 `win`/`lose` 두 컷만 만든다. `lose.early`·`lose.late`는 만들지 않는다(6절 규칙대로 `lose` 기본 문구로 대체됨).

## 1. 입력과 출력

**입력**: `out/combos.json`의 조합 1개(`frame`, `plan`) + `out/memes.json`에서 같은 `name`의 밈(인기 근거, `ip_risks`, `use_mode`). 오늘 TODAY.md 조합 1 기준:

```json
{ "combo": { "frame": "tap_rush", "score": 36.73,
    "plan": { "id": "2026-10-24", "title": "MemeRush Daily #001", "frame": "tap_rush",
      "frameParams": { "durationMs": 15000, "bpm": 120 }, "seed": "2026-10-24",
      "meme": { "name": "Babydoll Dance Challenge", "type": "rhythm", "summary": "...", "since": "2026-08",
        "url": "https://knowyourmeme.com/memes/babydoll-dance-trend", "useMode": "형식·문구·숫자·순간만 가져오기 ..." } } },
  "evidence": { "popularity_total": 73.45, "consensus": "독립 출처 4개", "ip_categories": ["음원", "실존 인물"],
    "online": [{ "platform": "TikTok", "...": "..." }], "community": [{ "community": "...", "...": "..." }] } }
```

**출력 1** `out/card_candidates.json`: 후보 3개(`A`/`B`/`C`), 각각 하루 판 JSON 전체 + `checks`. 카드 부분 예:

```json
{ "id": "2026-10-24", "title": "SHOULDER SHAKE RUSH", "frame": "tap_rush",
  "frameParams": { "durationMs": 15000, "bpm": 120 }, "seed": "2026-10-24",
  "meme": {
    "name": "Two-Step Dance Trend",
    "context": { "summary": "A viral two-step and shoulder-shake dance challenge.", "url": "https://knowyourmeme.com/memes/babydoll-dance-trend" },
    "prompt": "Tap on every beat. Keep the two-step alive.",
    "theme": { "background": "dance_floor", "player": "dancer", "boss": "judge", "goal": "spotlight" },
    "hope": "8 BEATS IN... DON'T TRIP",
    "win":  { "top": "TWO-STEP LEGEND", "bottom": "{result}. ICONIC.", "props": ["confetti"] },
    "lose": { "top": "LEFT FOOT? RIGHT FOOT?", "bottom": "{result}. SIT DOWN.", "props": ["sweat_drop"] },
    "share": "{result} in SHOULDER SHAKE RUSH. Beat me:" },
  "checks": { "pass": true, "flags": [], "source": "claude" } }
```

**출력 2** `out/card.json`(사장님이 고른 1개, `checks` 뺌)과 `out/asset_requests.json`(4절). 고른 기록은 `out/card_picks.jsonl`.

필드 규칙: `id`·`frame`·`frameParams`·`seed`는 `plan`에서 그대로 복사하고 생성기가 바꾸지 않는다. `plan` 최상위의 `rounds`·`scoreRule`·`expectedSessionS`는 GAME_FRAME_SPEC 6절에 없어 하루 판에서 빼고 `CARD.md`에만 적는다. `meme.name`은 원작 이름이 금지어면 일반 묘사로 바꾼다(위 예).

## 2. 생성 방식 (2단)

**1단 규칙 뼈대(LLM 없음)**: `plan`을 복사하고, 틀별 템플릿에서 `theme` 키(에셋 라이브러리 키만), `props`, 허용 치환자를 정한다. 틀별 허용 치환자: 모든 틀 `{result}`, `timing_stop`만 `{stopLabel}`·`{nearLabel}`. 같은 뼈대로 문구까지 채운 템플릿 후보 1개를 늘 만든다(API 실패 시 대체).

**2단 Claude API**: 뼈대의 문구 칸만 채운 후보 3개를 JSON으로 받는다. 프롬프트 뼈대:

```
system: You write captions for a 30-60s mobile mini game. English only. Output JSON only.
user:
  Meme situation (paraphrase, never quote): {summary}
  Game rule: {frame.rule}. Player wins if: {win_condition}.
  Fill these fields for 3 candidates with different angles (A literal, B self-mocking, C absurd prop):
    title, name, prompt, hope, win.top, win.bottom, lose.top, lose.bottom, share
  Rules: top/bottom <= 30 chars, ALL CAPS. Use only placeholders {allowed}. share must contain {result}.
  Never use: {blocklist}. No real people, brands, platforms, song titles or lyrics.
  Losing jokes only mock the player's own character.
  Also return "proper_nouns": every person, song, brand name in the summary, in English.
```

`proper_nouns`는 금지어 목록에 다시 넣고 후보를 한 번 더 검사한다(한국어 요약 속 고유명사를 영어로 잡으려는 장치).

**검사(후보마다)**:
- 금지어: 밈 원래 이름의 단어(일반어 dance, challenge 등 제외), 요약의 따옴표 안 단어, 근거의 `platform`·`community`·`source_name`, 고정 목록 `discovery/blocklist.txt`(플랫폼·상표), Claude가 돌려준 `proper_nouns`. 대소문자 무시, 단어 경계로 찾는다.
- 길이(치환 뒤 최장 표시 문구 기준, 예 `timing_stop` "99.999s off", `tap_rush` "999 taps"): `top`·`bottom`·`hope` 30자, `title` 24자, `name` 30자, `prompt` 60자, `share` 50자(뒤에 URL이 붙음).
- 문자: 출력 가능한 ASCII만(영어 MVP). 허용 목록 밖 `{...}`가 있으면 실패. `share`에 `{result}`가 없으면 실패.
- `theme`·`props` 키가 라이브러리에 없으면 실패가 아니라 에셋 요청으로 넘긴다.

실패한 후보는 버리고 API를 1번만 다시 부른다. 그래도 3개가 안 차면 템플릿 후보로 채우고 `source: "template"`로 표시한다.

## 3. 안전 관문

| 점검 | 자동 규칙 | 걸리면 |
|---|---|---|
| 저작권 | 원작 이름·노래 제목·따옴표 문구 금지어, 요약 문장 그대로 베끼기(5단어 이상 일치) | 후보 탈락 |
| 상표 | `blocklist.txt` + 근거의 플랫폼·출처 이름 | 후보 탈락 |
| 초상권 | `proper_nouns`의 인물, 대문자 두 단어 연속(이름 모양) | 탈락이 아니라 `flags`에 경고, 사장님 확인 |
| 혐오·조롱 | memes.py `SAFETY_CATEGORIES`의 영어 단어 + 집단 지칭어(국적·종교·성별 등) 목록 | 혐오는 탈락, 집단 지칭은 경고 |

- 입력 밈에 `safety_flags`가 있으면 발굴 단계에서 이미 빠진다(memes.py). 생성기는 다시 보지 않는다.
- `meme.context.summary`는 원작 이름을 담을 수 있다. 생성기는 이것도 영어 일반 묘사로 다시 쓰고 검사한다(공개 API가 `context`를 빼는지와 무관하게 안전하게).
- **사람이 고르는 지점(1회)**: `out/CARD.md`에 후보 3개를 나란히(자막 두 컷, 공유 문구, 경고, 인기 근거 한 줄, 필요한 새 에셋 수) 보여 준다. 사장님이 `python -m discovery card-pick --choice B`로 1개를 고른다. 고르기 전에는 `card.json`이 생기지 않는다(MEME_GAME_DESIGN 7절 "승인"). 문구를 손으로 고치면 같은 검사를 다시 돌린 뒤 저장한다.

## 4. 핏과의 인터페이스

`out/asset_requests.json`: 고른 카드의 `theme`·`props` 키 중 라이브러리(`discovery/asset_keys.json`, 새로 만듦)에 없는 것만 낸다.

```json
{ "challengeId": "2026-10-24", "style": "MemeRush-clone/art/champion/README.md",
  "requests": [
    { "key": "dancer", "file": "char_dancer_{state}.png", "states": ["idle", "tap", "stumble"],
      "desc": "Original chubby dancer, exaggerated smug face on beat, sweaty panic on stumble",
      "spec": { "format": "png", "alpha": true, "scale": "2x", "maxKB": 100 }, "usedBy": ["theme.player"] },
    { "key": "dance_floor", "file": "bg_dance_floor.webp", "desc": "Bright party floor under open sky, no text",
      "spec": { "format": "webp", "size": "1080x1920", "maxKB": 200 }, "usedBy": ["theme.background"] } ] }
```

- 규격은 ASSET_FORMATS.md 그대로: 게임 배경 WebP 720×1280~1080×1920·200KB, 캐릭터·소품·스티커 투명 PNG 2배·100KB 안팎, 영상 배경은 성공·실패 공용 2장(밈별로 요청하지 않음).
- 스타일 준수: `desc` 끝에 고정 꼬리말을 붙인다: "bold outline, glossy, bright sky, exaggerated reaction face, thick white sticker border, no text, no numbers, no logos, original character". 기준은 확정된 `art/champion/README.md`이고 `art/README.md`의 시험 이미지는 기준이 아니다.
- `desc`에는 원작 이름을 쓰지 않는다(2절 금지어 검사를 `desc`에도 적용).
- 핏이 파일을 넣으면 `asset_keys.json`에 키를 추가하고, 다음 날부터는 요청 없이 재사용한다.

## 5. 오늘(해커톤) 최소 범위와 순서

MVP_SCOPE에서 생성기는 보류(첫날 카드는 손으로 씀)다. 그래서 오늘은 **검사기와 오프라인 템플릿 경로**까지만 하고, 손으로 쓴 첫날 카드도 이 검사기로 통과시킨다. Claude API는 4단계에서 시간이 남을 때만.

1. 입력과 뼈대: `discovery/card.py`가 combos·memes를 읽어 뼈대를 만든다. 시험: 조합 1 뼈대의 `frame`·`frameParams`·`seed`가 `plan`과 같고 `win`·`lose`·`share` 칸이 있다.
2. 검사기: 금지어·길이·ASCII·치환자·혐오 검사. 시험: "BABYDOLL" 또는 "TikTok"이 든 문구가 실패하고, 31자 자막이 실패한다.
3. 선택과 출력: `card` 명령(`--offline` 기본)이 후보 3개와 CARD.md를, `card-pick`이 card.json·asset_requests.json·card_picks.jsonl을 쓴다. 시험: 오프라인 실행 뒤 `card-pick --choice A`의 card.json에 6절 필드(name, context, prompt, theme, hope, win, lose, share)가 모두 있다.
4. Claude API 후보: 프롬프트 호출, `proper_nouns` 재검사, 재시도 1회, 실패 시 템플릿. 시험: 가짜 응답(고정 JSON)으로 금지어 든 후보 1개가 버려지고 3개가 채워진다.
5. 발굴 출력에 붙이기: `run`이 TODAY.md 끝에 "카드 후보" 절을 붙인다. 시험: `run` 뒤 TODAY.md에 후보 A/B/C가 보인다.

**다음 단계 신호**: (a) 사장님이 3일 중 2일 이상 후보를 고치지 않고 고르면 API 경로를 기본으로. (b) 매번 손으로 고치면 프롬프트 각도(A/B/C)를 바꾼다. (c) 초상권·혐오 경고가 오탐이 잦으면 목록을 줄인다. (d) 두 번째 틀을 구현하면 그 틀의 `theme` 키 템플릿을 추가한다.

## 6. 위험과 모르는 것

- **Claude API 접근**: MEME_GAME_DESIGN 11절은 발굴 로직이 Claude API를 다룬다고 쓰지만 README상 ingest는 LLM을 부르지 않는다. 키·모델·비용 한도 **미확인**.
- **에셋 키 목록**: 라이브러리 키를 적은 파일이 없다. `asset_keys.json`은 새로 만들어야 하고 MVP 사무실 키(office, worker, boss, door, clock, confetti, email, calendar, boss_grab)로 시작한다. 앱 쪽 키 이름과 같은지 **미확인**.
- **결과 갈래**: MVP_SCOPE는 `timing_stop` 결과 3종을 요구하지만 이 생성기는 두 컷만 낸다. `timing_stop`이 오늘의 틀이면 `early`·`late`는 사람이 덧붙여야 한다.
- **필드 차이**: MVP_SCOPE 6절 인트로의 `meme.logline`은 카드 형식에 없다(`prompt`로 대신하는지 **미확인**). 발굴의 `scoreRule: "sum_of_errors"`와 스펙의 `"sum"`이 다르다.
- **틀 파라미터**: TODAY.md의 `tap_rush` `durationMs: 15000`은 한 판 30~60초 규칙에 못 미친다. frames.py 기본값(30초)과 달라 출력이 옛 실행일 수 있다(**미확인**). 생성기는 파라미터를 고치지 않고 CARD.md에 경고만 띄운다.
- **가사·안무 저작권**: 가사 인용은 원문이 없어 자동으로 못 잡는다. 사장님 확인에 기댄다. 안무 동작 자체를 그대로 옮기는 것이 문제인지 **미확인**.
- **금지어 누락**: 한국어 요약 속 인물 이름("제이미 밀러")은 Claude의 `proper_nouns`에만 기대므로 오프라인 경로에서는 놓칠 수 있다. 오프라인 후보에는 "고유명사 미검사" 경고를 붙인다.
- **담당**: 에셋 담당이 MVP_SCOPE에선 Simon님, ASSET_FORMATS에선 핏으로 적혀 있다. 같은 사람인지 **미확인**.
