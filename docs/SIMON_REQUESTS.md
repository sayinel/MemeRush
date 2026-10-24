# Simon님께 요청 (2026-10-24)

MVP 개발에 필요한데 Simon님만 할 수 있는 일을 모았습니다. 끝난 항목은 체크해 주세요. 필요 시점은 [MVP_SCOPE.md](MVP_SCOPE.md) 10절 일정 기준입니다.

## 1. 게임 스프라이트 — 지금 바로 (원래 13:45)

게임 화면 작업이 시작됐습니다. 그림이 오기 전까지는 도형으로 그리고, 파일이 들어오면 바로 바꿉니다.

- 넣을 곳: `web/public/game/{키}.png`. 코드는 아래 표의 이름 그대로 `/game/{키}.png`를 불러옵니다. 이름은 하루 판 파일(`web/content/challenges/2026-10-24.json`)의 `meme.theme` 키를 따르고, 동작이 여럿인 캐릭터는 뒤에 동작 이름을 붙였습니다.
- 형식: [ASSET_FORMATS.md](ASSET_FORMATS.md) 3·4번(스프라이트는 투명 PNG·2배 해상도, 배경은 WebP 허용), [GAME_SCREEN_GUIDE.md](GAME_SCREEN_GUIDE.md) 4·6·7절(흰 테두리, 글자 없음, 풀블리드)

| 체크 | 키(파일 이름) | 내용 |
|---|---|---|
| [ ] | `office` | 사무실 배경(배경은 `office.webp`도 됨) |
| [ ] | `worker_idle`, `worker_run`, `worker_grabbed`, `worker_buried`, `worker_escape` | 주인공 5동작: 대기(발 동동), 달리기, 잡힘, 파묻힘, 탈출 |
| [ ] | `boss_walk`, `boss_grab` | 보스 2동작 |
| [ ] | `clock`, `door` | 시계(숫자는 코드가 그림), 문 |
| [ ] | `email_pile`, `meeting_card` | 1·2라운드에서 시계를 가리는 방해물(3라운드는 보스) |
| [ ] | `confetti`, `email`, `calendar` | 결과 소품 |

## 2. 영상 배경과 반응 스티커 — 15:30

| 체크 | 넣을 곳 | 내용 |
|---|---|---|
| [ ] | `web/assets/video/bg_win.png`, `bg_lose.png` | 성공·실패 배경, 1440×2560, 위아래 25%는 자막 자리(ASSET_FORMATS 1번) |
| [ ] | `web/assets/video/sticker_win.png`, `sticker_early.png`, `sticker_late.png` | 결과별 반응 스티커(우쭐함, 억울함, 체념), 투명 PNG |

## 3. OG 기본 이미지 — 16:15

- [ ] `web/public/og-default.png`, 1200×630, PNG, 1MB 이하. 링크에 `ref`가 없을 때 미리보기로 씁니다.

## 4. 화면 가이드 수정

[MVP_SCOPE.md](MVP_SCOPE.md) 2절 "가이드 적용 규칙" 표에 적은 차이입니다. 구현은 그 표대로 진행하고 있으니 급하지 않습니다. 고치시면 표에서 해당 줄을 지워 주세요.

- [ ] `GAME_SCREEN_GUIDE.md` 10절 영상 구성: `setup` 필드는 없습니다. 게임 디자인 5절(희망 `meme.hope` → 반전 `top` + 소품 → 밈 결과 `bottom` + 순위)로 맞춰 주세요.
- [ ] `GAME_SCREEN_GUIDE.md` 8절(결과마다 배경 따로) ↔ 10절(성공·실패 2장): 하나로 정해 주세요. 지금 구현은 게임 장면 = 사무실 배경 하나, 영상 = 성공·실패 2장입니다.
- [ ] `GAME_SCREEN_GUIDE.md` 6절 자막 60자 → 30자(44px Anton으로 720px 폭에 들어가는 길이)
- [ ] 두 가이드의 같은 이름 토큰(`sky`, `sky-light`, `navy`) 값이 다릅니다. 통일하거나 게임 쪽 이름을 따로 두어 주세요.
- [ ] `SERVICE_SCREEN_GUIDE.md` 8절 문구 예시를 영어로(MVP는 영어). 예: "Play now", "See my rank", "Challenge a friend"
- [ ] `SERVICE_SCREEN_GUIDE.md` 4절 글꼴: 본문 Noto Sans KR → Noto Sans(라틴)
- [ ] `SERVICE_SCREEN_GUIDE.md` 3절 1등 메달 숫자 색 `#7A4A00`이 토큰에 없습니다.
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
