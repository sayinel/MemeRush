# PROGRESS

- [시작] 계획 문서 읽음. git init 완료. (Write 도구가 없어 Edit로 파일 생성)
- [설계 이탈 1] 입력 항목에 계획 문서 필드(name,url,source,metrics,measured_at,notes) 외에 선택 필드 `traits`(session_seconds, controls, score_type, impl_ease)와 `sim`(오프라인 링크 응답 흉내)을 추가. 이유: 필수 기준과 점수식 입력이 notes만으로는 안정적으로 나오지 않음.
- [설계 이탈 2] 걸러내기에 "링크 열리지 않음"과 "저작권 감점 30(규칙 일부)"도 탈락 사유로 추가. 이유: 과제가 이 둘을 탈락 사유로 요구함. 문서의 필수 기준 3개는 그대로.
- [1단계 완료] models, link_check, scoring, rules, sources/file_source, weights.json, ip_terms.json 작성.
- [2단계 완료] pipeline, cli, __main__, tests/fixtures/signals.json(10건) 작성.
- [3단계 작성] expected_rank.json, tests 4개 파일 작성(실행은 다음 줄에 결과).
- [3단계 완료] pytest 25 통과.
- [4단계 완료] README.md 작성.
- [수정] 규칙 한 줄이 소수점(10.00)에서 잘리던 버그 수정, 시험 추가. pytest 25 통과, run 출력 확인.
- [5-1 완료] Signal에 popularity_evidence/meme_context/popularity_hints 추가(없으면 빈 값). 근거 항목에 선택 입력 `growth`(최근 증가), `prev_rank`(이전 순위), `sim`(오프라인 링크 흉내) 허용: velocity 계산에 필요해서 추가한 이탈.
- [5-2 완료] verify_evidence: 근거 링크마다 기존 check_link로 link_status 부여(시험은 주입 fetch). 점수 반영은 `확인됨`만(열림-이름불일치도 제외, 계획 문서 "확인된 비율" 해석).
- [5-3 완료] discovery/popularity.py: velocity(growth 로그 눈금과 순위 상승 평균, 7일 초과 절반, 근거 중 최대)·reach(value 로그 눈금, 상한 1e6, 최대)·hints 3개(0~10 고정, 없으면 0+이유), 합계 0~50, evidence_confidence.
- [5-4 완료] 신호 강도 = 인기 요인 합계/50×10. 이탈: 인기 근거·hints가 둘 다 없는 옛 입력은 기존 growth 계산 유지(옛 시험 호환). weights.json에 reach_cap, popularity_max만 추가.
- [5-5 완료] 후보 카드 JSON/CANDIDATES.md에 근거 표·밈·점수 막대·배경·신뢰도, 확인 근거 0건이면 `⚠ 인기 근거 미확인`. 이탈: JSON에 `popularity_notes`(0점 이유) 추가.
- [5-6 완료] signals.json 상위 5개에 가상 인기 근거 채움(`_note` 표기), 게이지 낚시의 근거 1개는 404. 정답 순위 변화 없음(expected_rank.json 그대로; 점수만 소폭 변동).
- [5-7 완료] tests/test_popularity.py 15개 추가. 기존 test_card_fields_and_risks는 키 집합 `==`를 `>=`로 완화(새 필드 추가가 요구사항이라 불가피). pytest 40 통과.
- [5-8 완료] README 갱신.
- [설계 이탈 3] 링크 분류: 404/410/5xx=열리지 않음, 429·403·시간초과·예외=미확인(접속 제한은 "닫힘"이 아니라 "모름").
- [인기도 기준 전환 시작] 사장님 새 기준(링크 열림은 인기 근거 아님, 온라인·커뮤니티 인기도·합의도)을 읽고 시작. 시작 시 pytest 40 통과.
- [1단계 완료] discovery/evidence.py: online[]/community[] 정규화, tier 계산(1천/1만/10만/100만 경계), 옛 popularity_evidence → online 변환. Signal에 online/community/fading/astroturf_suspect/sample/needs_review 추가, popularity_hints는 읽지 않음.
- [2단계 완료] popularity.py 개편: 온라인 0~10(tier+로그 눈금, 확산 속도 가중 0.8~1.2), 커뮤니티 0~10(독립 커뮤니티 수 계수, 반대 의견 감점), 합의도(1개 단일 출처 x0.7, 2개 x0.9, 3개+ x1.0), fading −10, astroturf −15, 총점 0~100. weights.json: link_trust_by_status 삭제, signal_strength 10→20(합계 100 유지), popularity 블록 추가. 링크 검증은 link_info로만. 이탈: 감점 크기(10/15)와 눈금 상한(조회 1억, 언급 10만, 업보트 100만)은 내가 정함(사장님 확인 필요).
- [3단계 완료] discovery/memes.py: meme 신호(type, name, summary, since, safety_flags, ip_risks, target_seconds_suggestion), 유형 변환(number=초, timing=순간 길이, format=10.00), 3~15초 보정과 이유, 안전 플래그 탈락, 음원·상표·실존 인물 감점 10씩(최대 30)과 "형식·문구·숫자·순간만 가져오기" 표시. 이탈: 안전 플래그는 종류 불문 하나라도 있으면 탈락(알 수 없는 플래그도 안전쪽으로).
- [4단계 완료] 출력: TODAY.md(게임 틀 5, 밈 5, 조합 게임 1위 x 밈 3, meme_context·meme_card_hint JSON), CANDIDATES.md 새 카드(온라인 표, 커뮤니티 표, 합의도, 식는 신호, 막대, 배경), MEMES.md, memes.json, rejected_memes.json. 가상 자료는 "샘플 자료" 표시. run은 --memes 생략 시 signals 옆 memes.json을 씀.
- [5단계 완료] fixtures: signals.json·memes.json 새 모양(_note로 가상 표시), expected_rank.json 갱신(구슬 굴리기는 링크 404였어도 통과해 2위, 숫자 합 맞추기는 6위로 밀림). 새 시험: 단일 출처 감점, 식는 신호·astroturf 감점, 안전 탈락, 목표 시간 3~15 보정, 유형별 변환, 링크 열림 무관(모두 열림/모두 닫힘으로 바꿔도 점수·후보 동일), 하위 호환 변환.
- [기존 시험 수정 이유] test_scoring: 링크 신뢰도 항목 삭제(link_trust 시험·미확인 링크가 신호 강도를 0으로 만드는 시험 제거, score_signal에서 link_status 인자 삭제, 가중치 합 시험은 링크 항목 없이 100). test_popularity: 5요인(상승 속도·도달 규모·hints)·링크 확인된 근거만 점수에 넣는 시험·evidence_confidence를 전부 새 기준 시험으로 교체. test_integration: 카드 키 집합을 새 필드로 교체, 정답 순위 갱신. test_link_check는 그대로.
- [6단계 완료] discovery/ingest.py: normalize + 규칙 기반 파서(머리글 두 형식, 한글 머리말, "2,560만"·"수십만" 수치, 플랫폼·커뮤니티 이름 사전). python -m discovery ingest --text --kind --out. 못 읽은 항목은 needs_review이고 run에서 후보 제외. 이탈: 한 문장의 수치는 나열된 플랫폼에 균등 분배, 언급·업보트 수가 없으면 0.
- [7단계 완료] README.md를 새 기준으로 다시 씀.

## 틀 선택 (2026-10-24, GAME_FRAME_SPEC 4·5·6절)
- [틀-1 완료] discovery/frames.py: 틀 6종을 데이터로 정의(id, scoreDirection, 난이도 5/3/1, 잘 맞는 밈 유형, 파라미터 기본값·범위, 서버 검증 한 줄, 규칙어), guess_frame, clamp_params. `seed`는 파라미터가 아니라 하루 판 최상위(6절)에 둠.
- [틀-2 완료] discovery/infer.py + ingest: "한 줄 규칙"·"인기 이유"·"반대" 머리말 읽기, 조작(탭/스와이프/누르고·홀드/드래그), 판 길이(5초 이상 숫자, 범위는 위쪽 값), 점수 유형(점수/횟수/기록/시간) 추론. 추론한 traits는 `inferred: true`·`inferred_fields`, 글에 없는 항목은 틀 기본값(`frame_default_fields`)을 쓴다. 추론이 있으면 needs_review로 밀지 않고 통과, 카드에 "추론값·낮음" 표시. 틀 연결이 없는 추론 항목은 "구현할 틀 없음"으로 탈락. 이탈: 허용 조작에 hold·drag 추가(공통 규격 2절), 추론 입력만 불명 항목을 통과시키고 impl_ease는 틀 난이도(5/3/1)로 대신함. 옛 입력(traits 직접 기재)의 동작은 그대로.
- [틀-3 완료] memes.py: 유형을 number/timing/rhythm/obstacle/format으로 세분(classify_type: 밈 내용 먼저, 없으면 게임화 힌트). rhythm/obstacle은 목표 시간 없이(`targetMs: null`) `frameParamsHint`(bpm 60~180 / speed)를 제안. number/timing/format의 3~15초 보정은 그대로. `밈 유형` 줄이 없으면 format 고정 대신 본문 단어로 추정(parse_notes에 기록).
- [틀-4 완료] discovery/pairing.py: 조합 점수 = 틀 인기도(연결 게임 최고) x 밈 인기도 x 적합도(1.0/0.6/0.3, 유형 순서 number-timing-rhythm-obstacle-format에서 거리) x 구현 쉬움(0.5+난이도/10) x 최근 사용(직전 2일 같은 틀이면 0.5). out/history.jsonl, `decide` 명령, TODAY.md에 상위 3개 + 하루 판 JSON 초안, out/combos.json.
- [틀-5 완료] tests/test_frames.py 37개(추론 규칙, 밈 세분·틀 파라미터, 조합 점수, 최근 사용 감점, 틀 없으면 탈락, decide, 실제 조사 자료 통합: 게임 10개 중 9개 틀 연결·Drive Mad 탈락, 밈 5개의 유형 format/obstacle/rhythm이 틀 3종에 맞음). 자료는 tests/fixtures/guru_*_out.txt. 실제 자료로 찾아 고친 것: 맺음 절("종합 검토 및 총평")의 번호 목록이 항목으로 읽히던 것 중단, Poki·CrazyGames·itch.io·Google Play·App Store·Twitch를 온라인 플랫폼 사전에 추가(없어서 게임 인기도가 0이었음), tap_rush의 잘 맞는 유형에서 obstacle 제외(0.6으로 내림, 장애물·노동은 swipe_dodge가 1.0). pytest 115 통과.
- [틀-6 완료] README에 틀 선택·decide·추론값 표시 추가.
- [기존 시험 수정 이유] test_memes.test_run_writes_today_md_with_combo: 조합 칸이 "게임 틀 1위 x 밈 3"에서 "틀 x 밈 상위 3"으로 바뀌어 제목·JSON 블록 수(6→3, 조합마다 하루 판 초안 1개)·조합 이름 검사를 새 형식으로 바꿈. 나머지 77개는 수정 없이 통과.

## 길이 규칙 변경 (2026-10-24, 판 30~60초·3라운드)
- [길이-1 완료] discovery/config.py 신설: MIN_SESSION_S=30, MAX_SESSION_S=60, ROUNDS=3, ROUND_TARGET_RANGE_S=(3,5) + 라운드 여유 ROUND_SLACK_S=2, 기본 목표 4초. 시작 시 pytest 115 통과. 참고: frames.py에 `maxDurationMs`라는 이름은 없고, 그에 해당하는 것은 tap_rush `durationMs` 최대값(30000)과 timing_stop 검증 문구("1~30초")여서 그쪽을 바꿈.
- [길이-2 완료] scoring 필수 기준을 config 30~60초로(weights.json의 max_session_seconds 삭제), 한 판 길이 점수는 30초 이하 만점·60초 0.5. memes: 라운드당 목표 3~5초 보정(기본 4초, format도 4초), 카드에 rounds·expectedSessionS·sessionInRange 추가, MEMES.md에 "한 판 예상 길이" 줄. frames: timing_stop에 rounds(기본 3)와 targetMs 3000~5000, tap_rush durationMs 30000~60000. infer.py의 5초 이상 추론 하한은 그대로(추론은 하고, 통과 여부는 scoring이 판단).
- [길이-3 완료] pairing: score_direction이 asc인 틀의 하루 판 JSON에 rounds, scoreRule("sum_of_errors"), 예상 길이 추가. timing_stop은 frameParams.rounds=3.
- [길이-4 완료] tests/test_session_rules.py 신설(경계 29/30/60/61, 3~5초 보정, 예상 길이, JSON rounds). README 갱신.
- [기존 시험 수정 이유]
  - fixtures/signals.json의 session_seconds를 15/20/25/30/60 → 30/35/40/45/61로 이동: 새 규칙(30~60초)에서 옛 값(15~25초)이 전부 탈락해 순위 시험이 성립하지 않음. 순서는 유지, 60초 게임은 옛 규칙의 탈락(초과)을 유지하려고 61초로. expected_rank.json은 수정 없이 통과.
  - test_scoring: 기본 시험 입력 10초→30초(새 하한), 탈락 시험 31초→61초 + 29초 추가, 부분 점수 시험 30초→60초(새 기준 0.5).
  - test_memes: 목표 시간 보정 시험을 3~15초 → 3~5초로, format·제안 없음 기본값 10.00초 → 4.00초로, 6 7 밈은 6.7초 → 5초로 보정, 카드 키 집합에 rounds·expectedSessionS·sessionInRange 추가, 조합 JSON의 targetMs 6700 → 5000.
  - test_frames: tap_rush durationMs 하한 5000 → 30000, convert_target 기대값을 새 범위로.
- [주의] 3라운드 x (최대 5초 + 여유 2초) = 최대 21초라서 라운드 3·여유 2초 설정으로는 30~60초 안에 들어가는 조합이 없다(카드는 ⚠ 밖으로 표시). 라운드 수·여유·목표 범위 중 무엇을 바꿀지 사장님 결정 필요. (아래 PR 16 리뷰 반영에서 PR #18 정본으로 해결)

## PR 16 리뷰 반영 (2026-10-24)
### 1단계: 재현 결과 (코드로 먼저 확인)
- 재현됨(맞는 항목): 20초 게임이 "30~60초 밖"으로 탈락, 3라운드 예상 길이 15·21·27초(규격 30초와 불일치), "6 7"(6.7초)이 5.00초로 잘림, "1,000개 3만 개 12,345위 30% 3배 15초"가 [1, 3, 12, 30, 3, 15]로 읽힘, ultrasonic/debts/marionette가 sonic/bts/mario로 걸림, "특정인 조롱 요소 있음, 성적 암시 없음"이 안전 플래그 0개, 시들해지는 신호·인위적 바이럴 줄도 같은 우회, 점수 줄 "클리어 시간"이 unclear, `--signals out/signals.json --out out`이 입력 memes.json을 덮어씀(overwritten True), `--online`에서 같은 URL을 2번씩 엶(30회 호출, URL당 2회).
- 반려: 리뷰 "링크 신뢰도가 점수에서 빠졌습니다"(`weights.json:6`, `scoring.py:76-118`)는 **반려(코드 유지)**. 사장님이 2026-10-24에 정한 기준(링크 열림이 아니라 온라인·커뮤니티 인기도로 판단, 링크 상태는 표시용)이라 되돌리지 않는다. 대신 `docs/GAME_DISCOVERY_PLAN.md`의 점수식·파이프라인·시험·위험 절을 고치고 "인기도 기준 변경 (사장님 결정 2026-10-24)" 절을 새로 써서 계획과 코드를 맞췄다. 리뷰어가 짚은 "계획 문서가 안 바뀜"은 맞는 지적이라 문서 쪽을 고침.
- 나머지 리뷰 항목은 모두 재현되어 반영(아래).

### 2단계: 막는 문제 반영
- [1 짧은 원본 게임 탈락] 고침. `config.MAX_ORIGINAL_GAME_S=30`(상한만), `scoring.required_failures`의 하한 탈락 삭제, 길이 점수는 30초 이하 만점(분기가 다시 쓰임). 시험 자료 session_seconds를 원래 값으로 복원(스톱워치 15, 외곽선 20, 착륙 20, 낚시 25, 합 맞추기 30, 연타 서바이벌 60, 타자 30, 퀴즈 25, 마리오 20, 구슬 20). 이 값은 이전 기록의 "15·20·25·30·60 → 30·35·40·45·61"을 거꾸로 적용한 복원이다(커밋 이력이 한 덩어리라 원본 파일은 없음). 시험: 5·15·20·29·30 통과, 31·60 탈락.
- [2 한 판 시간 계산] 고침. 정본(PR #18)대로 `expected_session_s(라운드별 목표) = sum(소개 2 + 목표 + 반응 3) + 결과 3`, 값은 모두 config.py(ROUND_INTRO_S, ROUND_REACT_S, FINAL_RESULT_S, FIRST_DAY_TARGETS_S, NUMBER_MEME_MAX_S). 첫날 3·4·5초는 30초(범위 안). `ROUND_SLACK_S`는 삭제. 밈이 목표 시간을 주면 모든 라운드에 같은 값(규격 6절), 안 주면(format·rhythm·obstacle·제안 없음) 3·4·5초 계단: 이 규칙은 내가 정함(규격에 밈별 라운드 배분 규정이 없어서). 예: 6.7초 → 38.1초, 5초 → 33초, 3초 → 27초(범위 밖 표시).
  - 숫자 밈 7초: `convert_target`이 number만 7초까지, timing은 5초까지. "6 7"은 6.70초(예전 5.00초로 잘림).
  - `scoreRule`: 조합 메타에서 `"sum"`. 하루 판 파일(`plan`)은 규격 6절 모양(`id,title,frame,frameParams,seed,meme`)만 두고, `rounds`·`scoreRule`·`scoreDirection`·`expectedSessionS`·`sessionInRange`는 `combos.json`의 `plan_meta`와 TODAY.md "조합 메타" 줄로 옮김.
  - `gauge_stop`은 `asc`(목표 구간 중심과의 거리 합).
  - 틀 파라미터 보강: tap_rush(rounds, durationMs 10000 기본 8000~12000), swipe_dodge(rounds, roundCapMs 10000 기본 5000~15000), outline_trace(rounds, 라운드당 약 10초는 config.OUTLINE_ROUND_S), merge_drop(rounds 1, durationMs 60000 고정). timing_stop `targetMs`는 라운드별 배열(길이 = rounds, 각 3000~7000), 숫자 하나면 모든 라운드.
  - `visibleMs` 기본 1500, `visibleMs < 가장 짧은 targetMs`를 `clamp_params`가 보장(최소 0.5초 숨김은 내가 정한 여유값, `MIN_VISIBLE_HIDDEN_MS`).
- 시험 결과 중간: 3.11, 3.9 모두 통과(228개).

### 3단계: 고쳐야 할 것 반영
- [링크 신뢰도] 반려(위 참고), 계획 문서 보완 완료.
- [7일 감쇠] 고침. `popularity.is_stale`·`measured_end`, `online_item_score(now)`에서 측정 시각이 7일을 넘은 온라인 근거 점수를 `decay_factor`(0.5)로 줄임. 실제 경로 `run_pipeline`·`run_memes`·`cli`가 모두 `now`를 넘김. 달·해 단위 시각(`2026-10`, ingest가 만드는 형식)은 기간의 마지막 날 기준(안 그러면 이번 달 근거가 전부 절반이 됨). 시각을 모르면 줄이지 않음(내가 정함. 옛 metrics 경로는 모르면 절반인 기존 동작 유지). 시험: pipeline·memes·CLI 경로 각각에서 절반 확인, 정확히 7일은 감쇠 없음.
- [안전 필터 우회] 고침. `ingest.clauses/positive_clauses`: 쉼표·세미콜론·마침표·"및" 절 단위, 없음/해당 없음/아님/않음으로 끝나거나 없음으로 시작하는 절만 부정, 줄 전체가 부정일 때만 0개. 안전(`:324`), 저작권(`:318`), 유행 지남(`:303`), 조작 의심(`:306`) 모두 같은 함수. 저작권은 "상표 없음"이 상표 감점으로 세어지던 부작용도 함께 사라짐.
- [숫자 추출] 고침. 숫자 덩어리를 먼저 잡고 뒤 글자를 따로 봄(되돌아가기 제거). "1,000개"=1000, "3만 개"=3만, "12,345위" 제외, "30%"·"3배"·"15초" 제외. 추가로 "톱 10"·"상위 5"(순위)도 제외(실제 자료에서 슬라이스 마스터 값이 5로 읽히던 것).
- [저작권 용어 부분 일치] 고침. `rules.term_in`: 영문·숫자 용어는 단어 경계, 한글은 부분 일치. ultrasonic, debts, marionette가 더는 걸리지 않음.
- [입력 덮어쓰기] 고침. `cmd_run`이 입력(`--signals`, `--memes` 또는 옆 memes.json)이 출력 파일과 같은 파일이면(`os.path.samefile`) 아무것도 쓰지 않고 종료 코드 2.
- [점수 유형 판정] 고침. 점수 줄이 있으면 점수·횟수·기록·시간·숫자 등을 말하면 `single_number`, 여러·복합·등급·유형·문구면 `unclear`. 줄이 없으면 만들어 채우지 않음(추론이면 inferred 표시, 기존 정책). "줄이 없으면 통과" 부분은 추론값 표시와 함께 통과하는 기존 설계를 유지(사람 검토로 밀지 않는다는 이전 결정)했고, 대신 줄이 있을 때의 거꾸로 된 판정만 바로잡았다.
- [UTC 날짜] 고침. `config.KST`(+09:00 고정, 서머타임 없음. `zoneinfo`는 Windows에서 tzdata가 없으면 실패하므로 쓰지 않음), `parse_now`(시간대 없는 `--now`는 한국 시간), 판 id·seed·최근 사용 감점·TODAY.md 제목이 한국 날짜. `pick`의 `picked_at`도 KST.

### 4단계: 작은 것 반영
- [파이프라인 두 번 실행] 고침. `run_pipeline`·`run_memes`를 한 번씩만 돌리고(전체 순위) 상위 5개를 자름. 추가로 `memoize_fetch`로 같은 URL은 한 번만 엶(성공·예외 모두 기억). 재현: 이전 30회(URL당 2회) → 시험에서 URL당 1회.
- [응답 본문 크기 제한] 고침. `httpx.stream`으로 `LINK_BODY_MAX_BYTES`(512KB, config)까지만 읽고 중단(`read_capped`).
- ["반복 동작" 분류] 고침. memes `_TYPE_WORDS`에서 "반복 동작"을 rhythm으로(규격 5절 tap_rush), "반복 작업·노동"은 obstacle 유지. ingest `밈 유형` 줄도 "반복 동작" 먼저 비교.
- [README·.gitignore] 고침. docs 경로, 길이 규칙(PR #18), 3~5초·7초, 수치·없음 판정·점수 줄 설명, `out/` 추가. 문서·주석의 긴 줄표를 짧은 표기로 바꿈(출력 문구의 " - " 포함).

### 5단계: 테스트 보강
- [`test_ingest` 윈도우 경로] `tests/fixtures/guru_memes_out.txt` 상대 경로로 바꾸고 skipif 제거.
- [`test_session_rules` 같은 식 재계산] 손으로 계산한 값(30, 33, 27, 38.1, 39 등)과 이름별 기대값 표로 교체.
- [`test_frames` `>= 6`, 빈 목록 `all`] 실제 값으로 좁힘: 틀 연결 게임 9개(드라이브 매드만 없음), 틀 4종 집합, 상위 5개 이름·틀, 밈 상위 5개 이름·유형, 조합 1위, 하루 판 파라미터. 빈 목록이 통과하던 `all(...)` 앞에 개수 확인을 둠.
- [`expected_rank.json`] 아래 "expected_rank 손계산"으로 다시 만듦. 구현 출력을 복사하지 않음. hand_scores(게임)·hand_meme_scores(밈)를 0.15 이내로 비교하는 시험 추가.
- 새 시험: `test_review16.py`(저작권 경계, 덮어쓰기 방지, 한국 날짜, 링크 한 번 열기, 본문 제한, 감쇠 세 경로, 반복 동작), `test_ingest.py` 절 판정·수치·점수 줄, `test_frames.py` 틀 파라미터·visibleMs·예상 길이·조합 메타.
- [기존 시험 수정 이유] test_scoring 31초 탈락 + 단문 통과 추가(29초 탈락 삭제: 하한 없음), test_memes 숫자 밈 7초와 roundTargetsMs 키, test_frames 틀 파라미터 키 집합과 `plan` 모양(메타 분리), test_session_rules 위 설명대로.

### expected_rank 손계산 (기준 2026-10-24T12:00Z, README 점수식, 입력 자료의 근거 수치만 사용)
공통: 로그 눈금 L(x)=10 x log10(1+x)/log10(1+상한), 온라인 근거 점수 = (0.5 x 2 x tier + 0.5 x L(값, 1억)) x 속도 가중(0.8+0.4 x min(1, log10(1+하루 증가량)/6)), 커뮤니티 크기 = 0.6 x L(언급, 10만) + 0.4 x L(업보트, 100만), 폭 계수 = min(1, 0.4+0.2 x 커뮤니티 수), 총점 = (온라인 + 커뮤니티) x 5 x 합의 계수(출처 1개 0.7, 2개 0.9, 3개+ 1.0) − 식는 신호 10. 적합도 = 구현 쉬움(ease/5 x 30) + 길이 15(전부 30초 이하) + 점수 단순성 20 + 조작(탭만 15, 스와이프 포함 12) + 인기도/100 x 20.
- 스톱워치 타이머 정지: 고정 30+15+20+15=80. CrazyGames 51,000/증가 40,000 → 하루 5,714, 가중 1.05, (3+2.94) x 1.05=6.24. TikTok 4.2M(시작 10-15, 측정 10-23이라 8일) → 하루 52.5만, 가중 1.18, (4+4.14) x 1.18=9.62, 최고 9.62 + 플랫폼 +0.5 → 10(상한). 커뮤니티 합 언급 65, 업보트 5,400 → 크기 0.6 x 3.64+0.4 x 6.22=4.67, 폭 0.8 → 3.74. 출처 4개 계수 1.0 → (10+3.74) x 5=68.69 → 80+13.74=**93.74**.
- 구슬 굴리기: 고정 30+15+20+15=80. CrazyGames 25,000/7일 → 하루 3,571, 가중 1.04, (3+2.75) x 1.04=5.96. 커뮤니티 15/700 → 크기 0.6 x 2.41+0.4 x 4.74=3.34, 폭 0.6 → 2.01. 출처 2개 0.9 → (5.96+2.01) x 4.5=35.85 → 80+7.17=**87.17**.
- 착륙 타이밍: 고정 24+15+20+15=74. CrazyGames 9,000/5일 → 하루 1,800, 가중 1.017, (2+2.47) x 1.017=4.55. 커뮤니티 60/4,200 → 0.6 x 3.57+0.4 x 6.04=4.56, 폭 0.6 → 2.74. 출처 2개 0.9 → 7.28 x 4.5=32.77 → 74+6.55=**80.55**.
- 외곽선 자르기: 고정 24+15+20+12(스와이프만)=71. itch 12,000/12일 → 하루 1,000, 가중 1.0, 5.55. TikTok 800,000/12일 → 하루 6.7만, 가중 1.12, (4+3.69) x 1.12=8.63, 최고 8.63 + 0.5=9.13. 커뮤니티 Reddit 12/900: 크기 0.6 x 2.23+0.4 x 4.93=3.31 x 폭 0.6=1.98, 반대 의견 감점 4 x (mixed 0.5+반대 0.25)=3.0 → 0(하한). 출처 3개 1.0 → 9.13 x 5=45.62 → 71+9.12=**80.12**. 착륙(80.55)과 0.43점 차.
- 게이지 낚시: 고정 18+15+20+15=68. YouTube Shorts 2M/11일 → 하루 18만, 가중 1.15, (4+3.94) x 1.15=9.13, 커뮤니티 없음. 출처 1개 0.7 → 9.13 x 5 x 0.7=31.97 → 68+6.39=**74.39**.
- 숫자 합 맞추기(6위): 고정 18+15+20+12=65. itch 2,500(tier 2)/증가 2,000 → 가중 0.96, (2+2.12) x 0.96=3.98, 측정 10-14(10일 전) → 7일 초과 x0.5=1.99. Reddit 900(tier 1)/증가 500 → 0.92, (1+1.85) x 0.92=2.63(신선). 최고 2.63+0.5=3.13, 출처 2개 0.9, 식는 신호 → 3.13 x 4.5−10=4.1 → 65+0.82=**65.82**. 감쇠를 안 넣었다면 itch 3.98이 최고라 총점이 10.1로 올라가 점수가 달라짐(감쇠 시험을 겸함).
- 순위: 93.74 > 87.17 > 80.55 > 80.12 > 74.39 > 65.82 → top5 = 스톱워치, 구슬, 착륙, 외곽선, 게이지(합 맞추기 6위). 탈락: 연타 서바이벌(60초 > 30), 타자 러시(keyboard), 분위기 퀴즈(점수 유형 unclear), 슈퍼 마리오(규칙에 "마리오", 감점 30 → 탈락). 구현 출력과 모두 일치(93.74, 87.17, 80.55, 80.12, 74.39, 65.82).
- 밈: 6 7: 온라인 TikTok·YouTube 모두 tier 5, 값 상한 도달, 가중 1.2 → 10(상한). 커뮤니티 Reddit·디시·X 합 8,800/299,000 → 0.6 x 7.89+0.4 x 9.13=8.38, 폭 1.0, 반대(X 혼합 0.5+0.25=0.75를 3곳 평균 x4=1.0) → 7.38. 출처 5개 → (10+7.38) x 5=**86.92**. Nobody: TikTok 8M/902일 → 하루 8,869, 가중 1.063, (4+4.31) x 1.063=8.84, 커뮤니티 2,900/80,000 → 0.6 x 6.93+0.4 x 8.17=7.42 x 폭 0.8=5.94, 출처 3개 → 14.78 x 5=**73.9**. Wait for it: 온라인 10(상한), 커뮤니티 400/30,000 → 6.11 x 0.6=3.67 → 13.67 x 5=**68.33**. 2 5: TikTok 3M/19일 → 하루 15.8만, 가중 1.147, (4+4.05) x 1.147=9.23, 커뮤니티 에펨 120/4,000 → 4.90 x 0.6=2.94, 출처 2개 0.9 → 12.17 x 4.5=**54.76**. 노래 립싱크: 온라인 10(상한), 커뮤니티 700/40,000 → 6.48 x 0.6=3.89, 출처 3개 → 69.45, ip 감점 음원·실존 인물 20 → **49.45**. 혼자만 뜬 짤: 온라인 10 x 5 x 0.7=**35.0**. 한물간 챌린지: 온라인 10, 커뮤니티 negative 감점 4 → 0, 출처 3개 → 50 − 10=**40.0**. 순위 86.92 > 73.9 > 68.33 > 54.76 > 49.45 > 40 > 35 → meme_top5 일치. 안전 플래그 3건(조롱, hate speech, drugs)은 인기와 무관하게 탈락.
- 전부 측정일이 10-20 이후라 밈에는 7일 감쇠가 걸리지 않음(기준 10-24).
- 한계 표시: 손계산은 소수 셋째 자리에서 반올림했으므로 시험은 0.15 허용 오차로 비교한다.

### 확인 필요(사장님 결정 사항)
- 밈 목표 시간을 모든 라운드에 같은 값으로 두는 규칙(밈이 목표를 줄 때)과 안 줄 때 3·4·5초 계단: 규격 6절의 "숫자 하나면 모든 라운드"를 따랐다. 밈의 값이 한 라운드(예: 마지막)에만 적용되어야 하면 `config.round_targets_s` 한 곳을 고치면 된다.
- 3초 목표 밈은 27초라 30~60초 밖으로 표시된다(정본 계산 결과). 3초 밈은 라운드 수나 소개 시간을 조정해야 범위에 든다.
- 감점 크기(10/15)와 눈금 상한은 이전과 같이 임의값.

