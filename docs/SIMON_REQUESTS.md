# Simon님께 요청 (2026-10-24)

MVP 개발에 필요한데 Simon님만 할 수 있는 일을 모았습니다. 끝난 항목은 체크해 주세요. 필요 시점은 [MVP_SCOPE.md](MVP_SCOPE.md) 10절 일정 기준입니다.

## 1. 게임 그림 — 챔피언 스타일

게임 화면을 [챔피언 시안](../art/champion/README.md)(1_play, 2_champion, 3_close-miss) 스타일로 다시 그리고 있습니다. 그림이 없는 자리는 코드가 비슷하게 그리고, 파일이 들어오면 코드 수정 없이 바로 바뀝니다.

**넣는 방법**
1. `web/public/game/{키}.png`(배경은 `.webp`)로 저장
2. `web/public/game/manifest.json`에 `"{키}": "{파일 이름}"` 한 줄 추가. 게임은 이 목록에 있는 그림만 불러옵니다.

**공통 규칙** ([GAME_SCREEN_GUIDE.md](GAME_SCREEN_GUIDE.md) 4·6·7절, [ASSET_FORMATS.md](ASSET_FORMATS.md))
- 스프라이트: 투명 PNG, 정사각 768×768(크게 쓰는 것은 1024×1024), 파일당 200KB 안팎, 흰 스티커 테두리 + 갈색 안쪽 윤곽, 아래쪽 가운데에 발·바닥 기준점
- 그림 안에 글자·숫자 없음(자막·기록·버튼 글씨는 코드가 얹음), 실존 인물·기존 밈 캐릭터·상표 없음
- 주인공은 확정된 [표정 9종 시트](../art/character-champion/README.md)와 같은 캐릭터(주황 블롭 + 빨간 넥타이)

**이미 된 것**
- [x] 주인공 표정 9종: 시트를 잘라 `worker_deadpan`, `worker_shocked`, `worker_smug`, `worker_crying`, `worker_sweating`, `worker_laughing`, `worker_facepalm`, `worker_proud`, `worker_bored`로 넣었습니다(533×533). 더 선명한 원본이 있으면 같은 이름으로 바꿔 주세요.

**P0 — 시연에 꼭 필요**

| 체크 | 키 | 내용 | 참고 시안 |
|---|---|---|---|
| [ ] | `bg_office` | 게임 배경. 밝은 하늘과 방사광이 보이는 사무실(큰 창, 책상 정도만). 1080×1920 WebP, 위아래 25%는 조용한 그림(자막 자리), 풀블리드 | 1_play 배경 |
| [ ] | `boss_walk`, `boss_grab` | 보스 2동작: 걸어와 시계를 막아섬 / 주인공 뒷덜미를 잡음. 키 크고 어두운 정장, 실존 인물을 닮지 않게 | — |
| [ ] | `timer_panel` | 화면 위 시계 판. 금색 테두리의 남색 패널, 숫자 자리는 비움. 가로형 1024×400 | 1_play 위쪽 |
| [ ] | `clock_button` | 주인공이 내리치는 큰 빨간 둥근 버튼(글자 없음) | 1_play STOP 버튼 |
| [ ] | `email_pile`, `meeting_card` | 1·2라운드에서 시계를 가리는 방해물: 쌓인 메일 봉투 더미 / 달력 아이콘이 있는 회의 초대 카드(글자 없음) | — |
| [ ] | `banner_gold` | 결과 제목용 금색 리본 배너(글자 없음). 가로형 1024×400 | 2_champion 위쪽 |
| [ ] | `trophy` | 웃는 트로피 | 2_champion |

**P1 — 있으면 좋음**

| 체크 | 키 | 내용 | 참고 시안 |
|---|---|---|---|
| [ ] | `door` | 퇴근 문 | — |
| [ ] | `confetti`, `star` | 색종이 조각, 반짝 별(작은 스티커) | 2_champion |
| [ ] | `duck` | 곁다리 오리(놀란/어지러운 표정) | 1_play, 3_close-miss |
| [ ] | `poof` | 실패 때 터지는 연기 구름(글자 없음) | 3_close-miss |

## 2. 영상 배경 — 15:30

| 체크 | 넣을 곳 | 내용 |
|---|---|---|
| [ ] | `web/assets/video/bg_win.png`, `bg_lose.png` | 성공·실패 배경, 1440×2560, 위아래 25%는 자막 자리(ASSET_FORMATS 1번). 성공은 2_champion, 실패는 3_close-miss 분위기 |

결과별 반응 스티커는 따로 만들지 않아도 됩니다. 주인공 표정 스프라이트(`worker_smug`, `worker_shocked`, `worker_crying`)를 영상에도 그대로 씁니다.

## 3. OG 기본 이미지 — 16:15

- [ ] `web/public/og-default.png`, 1200×630, PNG, 1MB 이하. 링크에 `ref`가 없을 때 미리보기로 씁니다.

## 4. 화면 가이드 수정

[MVP_SCOPE.md](MVP_SCOPE.md) 2절 "가이드 적용 규칙" 표에 적은 차이입니다. 구현은 그 표대로 진행하고 있으니 급하지 않습니다. 고치시면 표에서 해당 줄을 지워 주세요.

- [ ] `GAME_SCREEN_GUIDE.md` 10절 영상 구성: `setup` 필드는 없습니다. 게임 디자인 5절(희망 `meme.hope` → 반전 `top` + 소품 → 밈 결과 `bottom` + 순위)로 맞춰 주세요.
- [ ] `GAME_SCREEN_GUIDE.md` 8절(결과마다 배경 따로) ↔ 10절(성공·실패 2장): 하나로 정해 주세요. 지금 구현은 게임 장면 = 사무실 배경 하나, 영상 = 성공·실패 2장입니다.
- [ ] `GAME_SCREEN_GUIDE.md` 6절 자막 60자 → 30자(44px Anton으로 720px 폭에 들어가는 길이)
- [ ] 두 가이드의 같은 이름 토큰(`sky`, `sky-light`, `navy`) 값이 다릅니다. 통일하거나 게임 쪽 이름을 따로 두어 주세요.
- [ ] `ADMIN_UX_GUIDE.md` 8절 문구 예시를 영어로(MVP는 영어). 예: "Play now", "See my rank", "Challenge a friend"
- [ ] `ADMIN_UX_GUIDE.md` 4절 글꼴: 본문 Noto Sans KR → Noto Sans(라틴)
- [ ] `ADMIN_UX_GUIDE.md` 3절 1등 메달 숫자 색 `#7A4A00`이 토큰에 없습니다.
- [ ] 후보 관리 화면, "오늘의 게임으로 정하기" 확인 창, 인기 근거 칩은 발굴 로직 운영 화면이고 MVP 앱에는 없다고 표시해 주세요.

## 5. 틀 규격

- [ ] `GAME_FRAME_SPEC.md` 6절 예시의 밈 카드 참조 "MEME_GAME_DESIGN.md 4절" → 6절

## 6. 발굴 로직 PR #16

자세한 내용은 PR #16의 리뷰 댓글에 있습니다. 머지 전에 필요한 것만 추렸습니다.

- [ ] 원본 게임 길이 30초 미만 탈락 제거(30–60초는 MemeRush 한 판 길이), 시험 자료 길이 원래 값으로
- [ ] 한 판 시간 계산: 라운드 소개 2초 + 반응 3초, 최종 결과 3초(첫날 30초)
- [ ] 숫자 밈 목표 시간 7초까지 허용(지금은 5.00초로 잘림)
- [ ] `scoreRule` `"sum"`, 하루 판 파일은 틀 규격 6절 모양만, `visibleMs` 기본 1500
- [ ] 안전 필터 "없음" 우회, 숫자 추출 오류, 저작권 용어 부분 일치 수정
- [ ] 링크 신뢰도를 점수에서 뺀 것이 바뀐 기준이면 `GAME_DISCOVERY_PLAN.md` 수정
