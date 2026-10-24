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
- [5-1 완료] Signal에 popularity_evidence/meme_context/popularity_hints 추가(없으면 빈 값). 근거 항목에 선택 입력 `growth`(최근 증가), `prev_rank`(이전 순위), `sim`(오프라인 링크 흉내) 허용 — velocity 계산에 필요해서 추가한 이탈.
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
- [2단계 완료] popularity.py 개편: 온라인 0~10(tier+로그 눈금, 확산 속도 가중 0.8~1.2), 커뮤니티 0~10(독립 커뮤니티 수 계수, 반대 의견 감점), 합의도(1개 단일 출처 x0.7, 2개 x0.9, 3개+ x1.0), fading −10, astroturf −15, 총점 0~100. weights.json: link_trust_by_status 삭제, signal_strength 10→20(합계 100 유지), popularity 블록 추가. 링크 검증은 link_info로만. 이탈: 감점 크기(10/15)와 눈금 상한(조회 1억, 언급 10만, 업보트 100만)은 내가 정함 — 사장님 확인 필요.
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
- [주의] 3라운드 x (최대 5초 + 여유 2초) = 최대 21초라서 라운드 3·여유 2초 설정으로는 30~60초 안에 들어가는 조합이 없다(카드는 ⚠ 밖으로 표시). 라운드 수·여유·목표 범위 중 무엇을 바꿀지 사장님 결정 필요.

