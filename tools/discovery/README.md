# Meme Rush 게임 틀·밈 발굴 로직 v1

설계 정본은 저장소 `docs/`: `GAME_FRAME_SPEC.md`(틀 공통 규격, 정본), `GAME_DISCOVERY_PLAN.md`(발굴 계획), `MEME_GAME_DESIGN.md`(게임 틀 × 밈 카드), `MVP_SCOPE.md`. 이탈 사항은 `PROGRESS.md`.

## 기준 한 줄
**링크가 열리는지는 인기 근거가 아니다.** 인기는 (1) 온라인 인기도(검색 관심, 영상 조회·해시태그 규모, 포털·스토어 순위, 확산 속도)와 (2) 커뮤니티 인기도(여러 커뮤니티에서 독립적으로 반복 언급·추천된 정도, 업보트 규모, 반대 의견)로 판단한다. 링크 열림 검사는 **정보 표시용**으로만 남고 점수·탈락에 쓰지 않는다.

## 실행
```
uv run --python 3.11 --with httpx python -m discovery run --signals tests/fixtures/signals.json --out out/
uv run --python 3.11 --with httpx python -m discovery ingest --text <조사본.txt> --kind game|meme --out <신호.json>
```
- `run`: 게임 틀 신호(`--signals`)와 밈 신호(`--memes`, 생략하면 signals 파일 옆의 `memes.json`, 없으면 밈 없이)를 읽어 `out/`에 낸다. 링크 열림 확인은 기본 오프라인 시연(`sim`), `--online`이면 실제 HTTP(같은 링크는 한 번만 열고, 응답 본문은 512KB까지만 읽는다). `--now <ISO시각>`으로 기준 시각 고정(시간대가 없으면 한국 시간).
  - 판 `id`·`seed`·최근 사용 감점의 날짜는 **Asia/Seoul 기준**(한국은 서머타임이 없어 +09:00 고정).
  - 입력 파일이 출력 파일(`memes.json` 등)과 같은 파일이면 덮어쓰지 않고 종료 코드 2로 멈춘다. `--out`은 입력과 다른 폴더로 쓴다. `out/`은 `.gitignore`에 있다.
- `pick --name "게이지 낚시"`: `out/picks.jsonl`에 선택 기록(후보에 없는 이름은 거부).
- 시험: `uv run --python 3.11 --with httpx --with pytest pytest -q`

## 입력: 인기 근거 (게임 틀·밈 공통)
`online[]`: `platform, metric, value_approx(대략 숫자), tier(1~5 영향 규모 눈금), since, measured_at, source_name, source_url(선택)` (+선택 `growth`=최근 증가량)
`community[]`: `community, mentions(대략 언급 수), upvotes_approx, sentiment(positive|mixed|negative), independent(앞 근거와 독립인가), counter_view(반대 의견 한 줄, 선택), source_name, source_url(선택)`
그 밖: `fading`(시들해지는 신호), `astroturf_suspect`(인위적 바이럴 의심) 불린.
- `tier`가 없으면 값에서 계산(1천 미만 1 · 1만 2 · 10만 3 · 100만 4 · 그 이상 5).
- 하위 호환: 옛 `popularity_evidence[]`는 읽을 때 `online[]`로 변환한다(`value`→`value_approx`, `url`→`source_url`). 옛 `url`·`link_status`·`sim` 필드는 있어도 되지만 점수·탈락에 쓰지 않는다.
- 게임 틀 신호는 `name, url, source, metrics, measured_at, notes, traits{session_seconds, controls, score_type, impl_ease}, sim, meme_context{summary, since, url}`을 더 받는다(`notes`에 `규칙: ...`이 있으면 첫 문장이 규칙 한 줄).
- 밈 신호(`{"memes": [...]}` 또는 리스트): `name, type(number|timing|rhythm|obstacle|format), summary, since, url(선택), safety_flags[], ip_risks[], target_seconds_suggestion` + 위 근거.
- 가상 자료는 `_note`에 "가상"/"샘플"을 쓰면 출력에 "샘플 자료"가 표시된다.

## 점수 (가중치: `discovery/weights.json`)
- **온라인 인기도 0~10**: 근거마다 `0.5 x (tier x 2) + 0.5 x log10 눈금(value_approx, 상한 1억)`에 확산 속도 가중(0.8~1.2: 하루 증가량 로그 눈금, 정보 없으면 1.0)을 곱하고, **측정 시각(`measured_at`)이 기준 시각보다 7일을 넘었으면 절반**(`decay_days`·`decay_factor`, `weights.json`)으로 줄인 뒤, 가장 높은 근거 + 다른 플랫폼 하나당 0.5(최대 1.5). 달·해 단위 시각(`2026-10`)은 그 기간의 마지막 날로 보고, 시각을 모르면 줄이지 않는다. 게임 틀·밈 모두 같은 경로(`compute_popularity(now=...)`)를 쓴다.
- **커뮤니티 인기도 0~10**: 독립 근거의 언급·업보트 로그 눈금 x 독립 커뮤니티 수 계수(1개 0.6, 2개 0.8, 3개 이상 1.0) − 반대 의견 감점(negative 1, mixed 0.5, counter_view +0.25의 평균 x 4점). 재인용(`independent:false`)은 규모에 안 들어간다.
- **합의도**: 독립 출처 수(온라인 플랫폼 + 독립 커뮤니티, 이름 기준 중복 제거). 1개면 **"단일 출처"** 표시와 총점 x0.7, 2개 x0.9, 3개 이상 x1.0. 긍정과 부정이 섞이면 "의견 엇갈림"을 덧붙인다.
- **총점 0~100** = `(온라인 + 커뮤니티) x 5 x 합의 계수 − 식는 신호 10(fading) − 인위적 바이럴 의심 15(astroturf_suspect)`, 0~100으로 자름. 후보에 `popularity_total`과 `popularity_scores{online, community, consensus_factor, fading_penalty, astroturf_penalty, total}`이 나온다.
- **게임 틀 적합도** = 필수 기준 통과(원본 게임 한 판 30초 이내, 탭·스와이프만, 숫자 점수 하나) x (구현 쉬움 30 + 한 판 길이 15 + 점수 단순성 20 + 조작 단순성 15 + **인기도 20**(인기도 총점/100 x 20)) − 저작권 감점(규칙 일부 30 → 탈락, 이름만 10). 원본 게임 길이는 **상한만** 둔다(짧은 게임을 찾는 것이므로 20초 게임도 통과, 30초 이하 만점). 링크 신뢰도 항목은 없다(사장님 결정, `GAME_DISCOVERY_PLAN.md`의 "인기도 기준 변경" 절). 근거가 하나도 없는 옛 입력만 `metrics.growth` 로그 눈금으로 대체한다(여기도 7일 초과 절반).
- 저작권 용어 비교: 영문·숫자 용어는 단어 경계로(`sonic`은 `ultrasonic`에, `bts`는 `debts`에 걸리지 않음), 한글 용어는 부분 일치.
- **밈 점수** = 인기도 총점 − ip 감점(음원·상표·실존 인물 각 10, 최대 30).

## 밈 규칙 (설계 3·5절)
- 유형 변환: number는 숫자를 초로(`target_seconds_suggestion`, **7초까지**: "6 7"은 6.70초), timing은 그 순간까지의 길이(5초까지), format은 대표값 4.00초(제안 값 무시, 하루 판은 첫날 3·4·5초). 라운드당 목표 시간은 3~5초(숫자 밈 7초)로 맞추고 범위 밖이면 가장 가까운 값으로 바꾸며 이유를 `targetReason`에 남긴다.
- 안전: `safety_flags`가 하나라도 있으면(특정인 조롱, 혐오, 약물, 성적 암시 등) 탈락, 이유는 `rejected_memes.json`.
- 음원·상표·실존 인물이 핵심(`ip_risks`)이면 "형식·문구·숫자·순간만 가져오기"로 표시하고 감점.
- `needs_review`(ingest가 못 읽은 항목)는 사람이 확인하기 전까지 후보에서 제외.

## 출력 (`out/`)
- `TODAY.md`: 게임 틀 순위(상위 5), 밈 순위(상위 5), **오늘의 조합 추천**(게임 틀 1위 × 밈 상위 3). 조합마다 `meme_context`(summary, since, url)와 `meme_card_hint`(type, targetMs, targetReason) JSON.
- `CANDIDATES.md`: 게임 틀 카드. 온라인 인기도 표 → 커뮤니티 인기도 표(커뮤니티·언급·업보트·분위기·독립 여부·반대 의견) → 합의도 → 식는 신호 → 점수 막대 → 유행 밈 → 배경 한 줄. 링크 열림은 카드 위쪽에 "정보 표시용"으로만.
- `MEMES.md`: 밈 카드(같은 구성 + 목표 시간·가져오기 방식).
- `candidates.json`(게임 틀), `memes.json`(밈), `rejected.json`, `rejected_memes.json`. 각 후보의 `link_info`는 링크 열림 정보(표시용).

## ingest (조사 본문 → 신호 JSON)
`discovery/ingest.py`. LLM을 부르지 않는다.
- `normalize(item, kind)`: 입력 dict를 검사·정규화(online/community 모양, 옛 `popularity_evidence` 변환, 필수 필드). 막히는 문제는 `needs_review=true`와 `review_reasons`, 사소한 것은 `parse_notes`.
- `parse_text(text, kind)`: 항목 머리글(`### 1. 제목` 또는 `1. **이름**`)로 나누고 한글 머리말 줄(`이름`, `밈 내용 한 줄`, `언제부터 퍼졌는지`, `온라인 인기도 근거`, `커뮤니티 인기도 근거`, `시들해지는 신호`, `저작권·상표 위험 요소`, `출처 이름과 주소` 등)을 읽는다. 수치는 본문의 "2,560만 회", "수십만 건"을 대략 값으로만 읽고 없으면 만들지 않는다(언급·업보트 수가 없으면 0). 근거도 이름도 못 읽은 항목은 `needs_review`.
- 한계: 밈 유형(`밈 유형` 줄이 없으면 본문 단어로 추정, 못 정하면 format), 반대 의견, 분위기(기본 positive)는 사람이 확인해야 한다. 같은 문장의 수치는 나열된 플랫폼·커뮤니티에 균등 분배한다.
- 수치 읽기: "1,000개"는 1000, "3만 개"는 3만, "2,560만 회"는 2560만. 순위("12,345위", "톱 10"), 비율("30%"), 배수("3배"), 시간("15초"), 날짜의 숫자는 조회수 합에 넣지 않는다.
- 없음 판정은 **절 단위**: 안전·저작권·시들해지는 신호·인위적 바이럴 줄을 쉼표·세미콜론·마침표·"및"으로 절로 나누고, "없음/해당 없음/아님/않음"으로 끝나는 절만 없음으로 본다. "특정인 조롱 요소 있음, 성적 암시 없음"은 조롱 절만 안전 플래그가 되고, 줄 전체가 없음일 때만 플래그·위험이 0개다.
- 점수 줄: 줄이 있으면 점수·횟수·기록·시간·숫자 등으로 말하면 `single_number`, 여러 지표·등급·문구 결과면 `unclear`(탈락). 줄이 없으면 만들어 채우지 않고 추론값(틀 기본)으로 표시한다.
- `밈 유형: 반복 동작`은 rhythm(tap_rush), `반복 노동·작업`은 obstacle(swipe_dodge). 규격 5절.

## 틀 선택 (스톱워치로 고정하지 않는다)
오늘의 판 = 틀 하나 + 틀 파라미터 + 밈 카드. 틀 6종은 `discovery/frames.py`(timing_stop, tap_rush, swipe_dodge, gauge_stop, outline_trace, merge_drop).
1. **게임 → 틀**: ingest가 "한 줄 규칙"·"인기 이유"에서 규칙어로 가장 가까운 틀을 `frame_guess`로 연결한다(타이머/멈춘다=timing_stop, 연타/박자/리듬=tap_rush, 피하/장애물/통과=swipe_dodge, 게이지/타이밍에 맞춰=gauge_stop, 외곽선=outline_trace, 합쳐/머지=merge_drop). 연결이 안 되면 "구현할 틀 없음"으로 탈락.
2. **추론값 표시**: 조작(탭/스와이프/누르고/드래그)·판 길이(5초 이상 숫자, 범위는 위쪽 값)·점수 유형을 글에서 추론하면 `traits.inferred: true`. 사람 검토로 밀지 않고 통과하지만 카드·TODAY에 "추론값, 신뢰 낮음"이 붙는다. 글에 없는 항목은 틀 기본값을 쓴다(만들어 채우지 않음).
3. **밈 유형**: number / timing / rhythm(박자·춤·바운스·반복 동작) / obstacle(피하기·반복 노동) / format. number·timing·format은 라운드당 목표 시간(3~5초, 숫자 밈 7초), rhythm·obstacle은 목표 시간 없이 틀 파라미터(bpm, speed)를 제안한다.
4. **조합 점수** = 틀 인기도(연결 게임 최고) x 밈 인기도 x 적합도(같은 유형 1.0, 한 칸 0.6, 그 밖 0.3; 유형 순서 number-timing-rhythm-obstacle-format) x 구현 쉬움(낮음 1.0, 중간 0.8, 높음 0.6) x 최근 사용(같은 틀이 어제·그제 모두 쓰였으면 0.5). 상위 3개가 `out/TODAY.md`(하루 판 JSON 초안 포함)와 `out/combos.json`에 나온다.
5. **판 정하기**: `python -m discovery decide --date 2026-10-24 --frame timing_stop [--out out]` → `out/history.jsonl`에 기록(같은 날짜는 덮어씀). 다음 `run`부터 최근 사용 감점이 적용된다.

## 길이 규칙 (정본: GAME_FRAME_SPEC 2절, PR #18)
- MemeRush **한 판은 30~60초, 3라운드**. 라운드마다 **소개 2초 + 목표 시간 + 반응 3초**, 마지막에 **결과 3초**. 한 판 예상 길이 = `sum(2 + 목표 + 3) + 3`. 첫날 목표 3·4·5초 = 3 x 5 + 12 + 3 = **30초**.
- 라운드당 목표 시간은 **3~5초, 숫자 밈은 7초까지**(범위 밖은 가장 가까운 값으로 보정). 밈이 값을 주면 모든 라운드에 같은 값(규격 6절 "숫자 하나면 모든 라운드"), 주지 않으면(format·rhythm·obstacle·제안 없음) 첫날 3·4·5초 계단. 예: 6.7초 숫자 밈 3 x (2+6.7+3) + 3 = 38.1초, 3초 밈 27초(⚠ 30~60초 밖으로 표시).
- 후보 **원본 게임**의 한 판 길이는 **상한 30초만** 둔다(계획 문서 필수 기준 "한 판 30초 이내"). 하한 탈락은 없다(30초 통과, 31초 탈락, 20초 통과). 30~60초는 MemeRush 한 판의 길이이지 원본 게임의 길이가 아니다.
- 하루 판 파일은 규격 6절 모양(`id, title, frame, frameParams{rounds, targetMs[라운드별], visibleMs}, seed, meme`). `visibleMs`는 가장 짧은 목표보다 0.5초 이상 짧게(기본 1500). 라운드 수·`scoreRule: "sum"`·`scoreDirection`·`expectedSessionS`·`sessionInRange`는 하루 판 파일이 아니라 조합 메타데이터(`combos.json`의 `plan_meta`, TODAY.md의 "조합 메타" 줄)로 나온다.
- 틀별 파라미터(규격 4절): `timing_stop`(rounds, targetMs, visibleMs), `tap_rush`(rounds, durationMs 라운드당 약 10초, bpm), `swipe_dodge`(rounds, roundCapMs 15초 이하, speed, gap), `gauge_stop`(zoneStart, zoneEnd, speed, rounds), `outline_trace`(rounds 모양 하나당 한 라운드 약 10초, shape, tolerance), `merge_drop`(rounds 1, durationMs 60초, boardSize). 점수 방향은 timing_stop·gauge_stop이 asc(오차·거리 합), 나머지 desc.
- **설정 위치: `discovery/config.py`** (MIN/MAX_SESSION_S, MAX_ORIGINAL_GAME_S, ROUNDS, ROUND_TARGET_RANGE_S, NUMBER_MEME_MAX_S, ROUND_INTRO_S, ROUND_REACT_S, FINAL_RESULT_S, FIRST_DAY_TARGETS_S). 초 수치는 여기서만 고친다.

## 소스 어댑터 추가
1. `discovery/sources/<이름>.py`에 `collect(self) -> list[Signal]`을 가진 클래스를 만든다(`sources/__init__.py`의 `Source` 참고).
2. 접속이 막히면 예외 대신 빈 목록을 돌려주고 실패를 기록해, 다른 소스가 계속 돌게 한다.
3. `cli.py`의 `cmd_run`에서 `FileSource` 대신(또는 함께) 새 어댑터를 쓰게 연결한다. 실제 웹 어댑터는 v1에도 없다.
