# MemeRush MVP 범위 확정본

- 기준: PRD v0.3 (2026-10-24)과 [게임 후보 조사](GAME_CANDIDATES.md)(PR #1). 이 문서와 PRD가 다르면 이 문서를 따릅니다.
- 게임: 1순위 후보인 스톱워치 타이머 정지를 게임 틀로 쓰고, 그날의 밈을 밈 카드로 얹고, 캐릭터·연출 중심으로 만듭니다([게임 디자인](MEME_GAME_DESIGN.md)). 첫 게임은 FRIDAY 5PM — CLOCK OUT!입니다. PRD의 5문항 퀴즈를 대신합니다.
- 조건: 5시간, 2명. 동훈님은 MVP 코드 전체, Simon님은 [발굴 로직](GAME_DISCOVERY_PLAN.md)(PR #2)과 MVP 에셋을 맡습니다.
- 데모 시나리오: A 플레이 → 결과 화면에서 "Challenge a Friend" → B가 미리보기를 확인하고 링크 열기 → B가 리그에 참여해 플레이 → 두 사람이 Friends 랭킹에 함께 표시되고 Global 랭킹에도 오름 → 두 사람이 각자 기록에 맞는 MP4 저장·공유. 발표 때는 심사위원이 QR 코드로 들어와 Global 랭킹에 오릅니다.

이 시나리오에 필요 없는 기능은 모두 보류합니다.

## 1. 범위

| 구분 | 항목 |
|---|---|
| 유지 | 게임 1개 · 닉네임 + 익명 세션 · 서버 기록 검증 · 무제한 재도전, 최고 기록 인정 · Global 랭킹과 Friends 랭킹 둘 다 표시 · 리그 자동 생성과 초대 링크 · 1위와의 기록 차이 · OG 메타와 동적 미리보기 이미지 · 결과 3종(`win`, `lose`·`early`, `lose`·`late`) 연출과 하이라이트 영상, MP4 다운로드·파일 공유 · Wordle식 텍스트 공유 · fallback(결과 카드, 링크 복사) · 이벤트 기록 |
| 보류 | 두 번째 게임 · 밈 카드 생성기(첫날 카드는 손으로 씀, 시간이 남으면 만듦) · "오늘의 게임이 뽑힌 이유" 화면(발굴 로직 결과 표시) · 한국어 · 앱 안의 AI 기능(AI Meme Director 포함) · Friend Rivalry, Almost a Legend · Weekly League, Streak · PlatformIdentity, VideoExport · `/api/platform/config` · Telegram, Discord, TikTok 연동 |

## 2. 결정 사항

PRD에서 비어 있거나 절마다 어긋나던 항목, 게임이 바뀌면서 새로 정한 항목입니다.

| 항목 | 결정 | 관련 PRD |
|---|---|---|
| 게임 규칙 | 한 판은 3라운드([틀 규격](GAME_FRAME_SPEC.md) 2절). 라운드마다 시계가 흐르고, 처음 1.5초만 보인 뒤 화면 안의 사건(첫 게임은 메일 더미 → 회의 초대 → 보스)으로 가려짐. 목표 시간에 맞춰 화면을 한 번 탭해 멈춤. 라운드 사이에는 짧은 반응 연출. 한 판 30초 이상(첫날 30초). 연출은 [게임 디자인](MEME_GAME_DESIGN.md) 4절 | §3.3, §8.1 |
| 목표 시간 | 하루 하나, 모두 같음. 라운드별 3–5초(숫자 밈은 7초까지), 하루 판 파일의 `frameParams.targetMs` 배열이 정함(첫날은 3·4·5초) | §8.1 |
| 기록 | 세 라운드 오차(ms)의 합 = Σ\|멈춘 시각 − 목표 시간\|. 낮을수록 좋음. 표시는 "0.087s off" | §8.1 |
| 재도전 | 무제한. 끝나면 0.5초 안에 처음(1라운드)부터 다시 시작. 그날의 공식 기록은 합산 오차가 가장 낮은 판 | §8.2 |
| 측정·검증 | 클라이언트가 라운드별 탭 시각을 재고, 서버가 라운드별 오차와 합을 계산. 서버는 측정값이 정확히 3개가 아니거나, 하나라도 1–15초 범위 밖이거나, 세 측정값의 합이 시작~종료 요청 사이의 서버 시간보다 길면 거부. 두 시각은 모두 DB `now()`로 기록(서버리스 인스턴스 간 시계 차이 회피). 클라이언트 측정값을 서버 시간보다 짧게 조작하는 것은 막지 못함 — 알려진 한계로 둠 | §8.2, FR-G03 |
| 동점 | 같은 순위(1, 1, 3). 표시 순서는 먼저 기록한 사람이 위 | — |
| 기록 차이 | 1위와의 오차 차이. 내가 1위면 2위보다 앞선 차이 | FR-C04 |
| 랭킹 | Global과 Friends 두 랭킹을 모두 보여 줌. Global은 전체 플레이어 상위 50 + 내 순위(50위 밖이어도 표시), CDN 캐시 5초. Friends는 내가 속한 리그의 리더보드(화면 표시 이름이 Friends, 내부 이름이 리그) | §3.4, §14.2 |
| 언어 | 영어만 | FR-G05 |
| AI | 게임 틀 선정은 Simon님의 발굴 로직(PR #2), 밈 → 밈 카드 변환은 밈 카드 생성기가 맡음. 둘 다 앱 밖에서 돌고, 결과는 사람이 승인한 뒤 커밋 | FR-G06, §8.3 |
| 게임 설정 | DB가 아니라 `content/challenges/2026-10-24.json`에 둠 | §8.1 |
| 에셋 | Simon님 담당. 규칙만 참고하고 그림·이름·소리는 새로 만듦. 유명 밈 인물·상표는 쓰지 않음. 스타일은 [챔피언 스타일](../art/champion/README.md), 파일 형식은 [ASSET_FORMATS.md](ASSET_FORMATS.md)를 따름 | §10.6 |
| 사용자 식별 | 익명. 닉네임을 입력하면 서버가 무작위 세션 토큰을 httpOnly 쿠키 `mr_sid`로 발급. 플레이어 ID는 응답에 넣지 않음. 같은 브라우저 안에서만 같은 사용자로 취급 | §7.4, AC-07 |
| 리그 | 1인 1리그. "Challenge a Friend"를 처음 누를 때 자동 생성하고 만든 사람을 멤버로 넣음. 한 사람이 여러 리그에 속할 수 있음 | §9.1 |
| 리그 참여 | 초대 링크로 들어온 사람은 "Join {owner}'s league & play" 버튼을 눌러야 참여. 이 버튼이 명시적 동의 | §9.2 |
| 결과 화면의 리그 | URL의 리그 → 내가 만든 리그 → 참여한 첫 리그 순으로 하나를 표시 | §3.4 |
| 링크 | 공개: `/c/{challengeId}?ref={referralId}` · 리그 초대: 같은 주소 + `&league={inviteToken}` | §5.2, §9.2 |
| 미리보기 | OG 생성에 `league` 파라미터를 쓰지 않음. 공유한 사람 본인 기록만 표시하고 닉네임·리그 정보는 넣지 않음 | AC-17 |
| 결과 종류 | 합산 오차 300ms 이하 `win`(Perfect), 넘으면 `lose`. `lose`는 오차가 가장 컸던 라운드가 빨랐으면 `early`(Too Early), 늦었으면 `late`(Too Late). 서버가 정하고, 결과 화면 연출과 영상이 이 종류를 따름. 라운드 사이의 반응 연출은 라운드마다 따로(100ms 이하 NICE, 빠름, 늦음) | §3.5, §9.3 |
| 영상 생성 | 동기 처리. 요청 하나에서 렌더링 → 업로드 → URL 반환. 렌더링이 15초를 넘으면 그때 비동기로 전환. 최고 기록이 바뀌면 새로 만듦 | §10.4 |
| DB 접근 | 모든 DB 접근은 Next.js API에서 service role 키로 함. 클라이언트에는 Supabase 키를 두지 않음. 모든 테이블에 RLS를 켜고 정책은 만들지 않음 | AC-18 |
| 통신 | 웹소켓 없이 REST만. 종료 응답에 내 순위를 같이 담음 | — |
| 호스팅 | Vercel 기본. 1:15(13:45) 체크포인트에서 배포 환경 렌더링이 안 되면 렌더링만 컨테이너(Railway·Fly·Render 중 하나)로 분리 | §12.1 |

### 가이드 적용 규칙

[서비스 화면 가이드](SERVICE_SCREEN_GUIDE.md), [게임 화면 가이드](GAME_SCREEN_GUIDE.md)와 이 문서·[게임 디자인](MEME_GAME_DESIGN.md)이 어긋나는 곳은 아래처럼 구현합니다. 가이드가 고쳐지면 이 표에서 해당 줄을 지웁니다.

| 어긋나는 곳 | 구현 기준 |
|---|---|
| 게임 화면 가이드 10절의 영상 구성(`setup` → 두 컷 → CTA) | 게임 디자인 5절: 희망(`meme.hope`) → 반전(`top` + 소품) → 밈 결과(`bottom` + 순위). `setup` 필드는 없음 |
| 배경: 게임 화면 가이드 8절(결과마다 따로) ↔ 10절(성공·실패 2장) | 밈 카드의 `theme.resultBackgrounds`(`win`·`early`·`late`, 선택)가 있으면 그 배경을 쓰고, 없으면 성공·실패 2장을 씀. 게임 장면은 사무실 배경 하나에 스프라이트로 차이를 냄 |
| 자막 길이: 게임 화면 가이드 6절 60자 ↔ 게임 디자인 30자 | 30자. 밈 카드 검증도 30자 |
| 같은 이름 토큰(`sky`, `sky-light`, `navy`)의 값이 두 가이드에서 다름 | 서비스 가이드 값은 CSS 변수로, 게임 가이드 값은 Phaser 코드의 색 상수로 둠. 게임 장면은 캔버스에 그리므로 두 값이 부딪히지 않음 |
| 서비스 화면 가이드의 한국어 문구 | 문구 규칙(짧게, 동사 + 결과)만 따르고 문구는 영어. 예: "Play now", "See my rank" |
| 서비스 화면 가이드 4절 글꼴 | 자막은 Anton, 제목·버튼은 Jua(영문 글자 포함), 본문은 Noto Sans(라틴) |
| 서비스 화면 가이드 3절의 토큰에 없는 `#7A4A00` | 토큰 `warn-text`(`#7A5200`) |
| 후보 관리 화면, "오늘의 게임으로 정하기" 확인 창, 인기 근거 칩 | MVP 앱에서는 만들지 않음 |

## 3. 게임 설정

하루 판 파일 형식은 [GAME_FRAME_SPEC.md](GAME_FRAME_SPEC.md) 6절, 그 안의 밈 카드(`meme`)는 [MEME_GAME_DESIGN.md](MEME_GAME_DESIGN.md) 6절을 따릅니다. 서버가 쓰는 값은 아래와 같습니다.

- `frame`: MVP는 `timing_stop`만 지원
- `frameParams.rounds`: 라운드 수(3), `frameParams.targetMs`: 라운드별 목표 시간 배열(길이 = `rounds`), `frameParams.visibleMs`: 라운드마다 시계가 보이는 시간
- `meme.win`·`meme.lose`(`early`·`late` 갈래 포함): 결과별 두 줄 자막과 소품, `meme.hope`·`meme.share`: 영상과 공유 문구
- 서버 로딩 시 zod로 검증

### 탭 판정

- 측정은 `performance.now()`로 하고, 이벤트는 `click`이 아니라 `pointerdown`을 씁니다. `click`은 손가락을 뗀 뒤에 발생해서 누른 순간보다 늦습니다.
- 탭 영역에 `touch-action: manipulation`을 줘서 더블탭 확대 판정으로 인한 지연을 없앱니다.
- 1라운드 타이머는 시작 API 응답을 받은 순간부터, 2·3라운드 타이머는 라운드 소개가 끝나는 순간부터 잽니다. 서버에는 라운드별 경과 시간만 보냅니다. 화면 표시(`requestAnimationFrame`)는 보여 주기용이고 측정에 쓰지 않습니다.

## 4. DB

```sql
create table players (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,          -- 쿠키 mr_sid 값, 무작위 128비트
  nickname text not null check (char_length(nickname) between 1 and 20),
  created_at timestamptz not null default now()
);

create table leagues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references players(id),
  invite_token text not null unique,          -- 무작위 128비트, base64url
  created_at timestamptz not null default now()
);

create table league_members (
  league_id uuid not null references leagues(id),
  player_id uuid not null references players(id),
  joined_at timestamptz not null default now(),
  primary key (league_id, player_id)
);

create table referrals (
  id text primary key,                         -- 불투명 무작위 토큰
  challenge_id text not null,
  source_player_id uuid not null references players(id),
  league_id uuid references leagues(id),       -- 리그 초대 링크일 때만
  created_at timestamptz not null default now()
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id),
  challenge_id text not null,
  referral_id text references referrals(id),   -- null이면 일반 유입
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  round_elapsed_ms int[],                      -- 라운드별 클라이언트 측정값
  round_error_ms int[],                        -- 라운드별 오차, 서버 계산값
  error_ms int,                                -- 라운드 오차의 합, 서버 계산값(순위 기준)
  outcome text,                                -- 'win' | 'lose', 서버 계산값
  outcome_variant text,                        -- timing_stop의 lose 갈래: 'early' | 'late'
  video_path text                              -- Storage 경로
);

create index attempts_ranking on attempts (challenge_id, error_ms) where error_ms is not null;

create view best_attempts with (security_invoker = true) as
select distinct on (a.player_id, a.challenge_id)
  a.id, a.player_id, a.challenge_id, a.error_ms, a.finished_at,
  a.round_elapsed_ms, a.round_error_ms, a.outcome, a.outcome_variant, a.video_path, p.nickname
from attempts a
join players p on p.id = a.player_id
where a.error_ms is not null
order by a.player_id, a.challenge_id, a.error_ms, a.finished_at;

create table events (
  id bigint generated always as identity primary key,
  type text not null,
  challenge_id text,
  player_id uuid,
  referral_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table players enable row level security;
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table referrals enable row level security;
alter table attempts enable row level security;
alter table events enable row level security;
```

- `best_attempts`는 플레이어별 최고 기록입니다. `security_invoker`를 켜서 기본 테이블의 RLS를 그대로 따르게 합니다.
- Storage: 공개 버킷 `videos`, 경로 `{challengeId}/{attemptId}.mp4`

## 5. API

플레이어는 `mr_sid` 쿠키로 식별합니다. 쿠키가 필요한 API에 쿠키가 없으면 401입니다. 어떤 응답에도 플레이어 ID와 세션 토큰을 넣지 않습니다.

| 메서드 | 경로 | 요청 | 응답 | 비고 |
|---|---|---|---|---|
| POST | `/api/players` | `{ nickname }` | `{ nickname }` | 쿠키 발급. 쿠키가 있으면 닉네임만 갱신 |
| GET | `/api/challenges/{id}` | — | 밈 카드 | `meme.context`는 빼도 됨 |
| POST | `/api/attempts` | `{ challengeId, ref? }` | `{ attemptId }` | `started_at` 기록. 유효하지 않은 `ref`는 무시 |
| POST | `/api/attempts/{attemptId}/finish` | `{ roundElapsedMs: number[3], leagueId? }` | `{ roundErrorsMs, errorMs, bestErrorMs, isNewBest, globalRank, friendsRank, outcome, outcomeVariant }` | 내 시도이고 아직 끝나지 않았을 때만. 2절의 검증 규칙 적용. `friendsRank`는 `leagueId`(화면에 표시 중인 리그)가 있고 내가 멤버일 때만, 아니면 null |
| GET | `/api/me?challengeId=` | — | `{ nickname?, bestErrorMs?, globalRank?, leagues: [{ leagueId, ownerNickname, isOwner }] }` | 재방문 시 화면 결정. 쿠키 없으면 빈 값 |
| GET | `/api/leaderboard?challengeId=` | — | `{ rows: [{ nickname, errorMs, rank }] }` | Global 상위 50. 모두에게 같은 응답이라 `Cache-Control: public, s-maxage=5`. 내 순위는 여기 넣지 않고 `/api/me`·finish 응답의 `globalRank`로 표시 |
| GET | `/api/leagues/invites/{token}` | — | `{ leagueId, ownerNickname, memberCount }` | 인트로 화면 표시용 |
| POST | `/api/leagues/join` | `{ inviteToken }` | `{ leagueId }` | 이미 멤버면 그대로 성공 |
| GET | `/api/leagues/{leagueId}/leaderboard?challengeId=` | — | `{ rows: [{ nickname, errorMs, rank, isMe }], myRank, gapMs }` | 멤버만 조회. 기록이 있는 멤버만 표시 |
| POST | `/api/referrals` | `{ challengeId, invite: boolean }` | `{ url }` | 기록이 있는 사람만. `invite`면 리그가 없을 때 만들고 `league` 토큰을 붙임 |
| POST | `/api/videos` | `{ challengeId }` | `{ url, downloadUrl, type }` | 최고 기록으로 만듦. 그 기록의 영상이 이미 있으면 기존 URL |
| GET | `/api/og/{referralId}` | — | 1200×630 PNG | 결과 카드 다운로드에도 사용 |
| POST | `/api/events` | `{ type, challengeId, ref?, meta? }` | 204 | 클라이언트 이벤트용 |

## 6. 화면

라우트는 `/c/[challengeId]` 하나이고, `/`는 여기로 리다이렉트합니다.

1. **인트로**: 제목, 밈 카드의 `logline`, 정지된 장면이 흔들리며 캐릭터가 뛰어나오는 연출, 리그 초대면 "{owner}'s league" 표시, 쿠키가 없을 때만 닉네임 입력, 시작 버튼(리그 초대면 "Join & Play")
2. **게임**: Phaser 캔버스, 화면 전체가 탭 영역. 라운드 소개(2초) → 시계가 1.5초 보이고 가려짐 → 탭 → 라운드 반응(3초)을 세 번. 세 라운드가 끝나면 결과 종류별 연출 뒤 오차·최고 기록·Global 순위·Friends 순위와 큰 Retry 버튼, "See results" 버튼
3. **결과**: 최고 기록과 그 결과 종류의 연출 → 랭킹(Global | Friends 탭) → 영상(생성 → 미리보기 → 저장·공유) → 공유 버튼

### 주 버튼

[서비스 화면 가이드](SERVICE_SCREEN_GUIDE.md) 5절에 따라 채운 버튼은 한 화면에 하나만 두고, 나머지는 글자 링크로 낮춥니다.

| 화면 | 채운 버튼 | 글자 링크 |
|---|---|---|
| 인트로 | 시작("Play" 또는 리그 초대면 "Join & Play") | — |
| 게임 직후 | Retry | See results |
| 결과 | Challenge a Friend | 영상 만들기·저장·공유, 링크 복사, 다시 플레이 |

결과 화면에서 Challenge a Friend를 주 버튼으로 둔 이유: Friends 랭킹과 리그 초대가 데모 시나리오의 중심이고, 친구가 들어와야 순위 경쟁과 재방문이 생기기 때문입니다.

### 랭킹 탭

- **Global**: 상위 50 목록. 내가 50위 밖이면 목록 아래에 내 순위 한 줄을 따로 붙입니다.
- **Friends**: 리그 리더보드 전체와 1위와의 기록 차이. 내 줄을 강조합니다(`isMe`). 리그가 없으면 "Challenge a Friend" 버튼을 띄웁니다.
- 기본 탭: 리그가 있으면 Friends, 없으면 Global. 두 탭은 언제든 오갈 수 있습니다.

- 이미 기록이 있는 사람은 인트로 대신 결과로 갑니다. 결과 화면에서 언제든 다시 플레이할 수 있습니다. 리그 초대 링크로 왔는데 아직 멤버가 아니면 결과 화면에 Join 버튼을 띄웁니다.
- 인앱 브라우저(UA에 Instagram, FBAN, FBAV, TikTok 등)에서는 상단에 "영상 저장이 안 되면 외부 브라우저로 열기" 배너를 띄웁니다. UA는 이 표시에만 씁니다.

### 미리보기 (OG)

- `/c/[challengeId]`의 `generateMetadata`에서 `ref`가 유효하면 설명 "I was {error}s off. Can you beat me?"와 이미지 `/api/og/{ref}`를 씁니다. 아니면 기본 설명과 `/og-default.png`를 씁니다.
- 이미지 URL은 절대 경로로 씁니다. 크롤러는 JS를 실행하지 않습니다.

### 공유

- 텍스트 복사: Wordle식 한 줄 + 공개 링크. 밈 카드의 `share` 문구를 씀. 예: `MemeRush #001 6…7 🤷 6.734s (0.034s off) — can you beat me? {url}`
- 영상이 준비되면 바로 `fetch`해서 `File`로 만들어 둡니다. 버튼을 누른 뒤에 받으면 iOS에서 사용자 동작으로 인정되지 않아 공유가 거부될 수 있습니다.
- `navigator.canShare({ files })`가 참이면 `navigator.share({ files, text })`, 아니면 다운로드 링크와 링크 복사를 보여 줍니다.
- 다운로드 링크는 Storage 공개 URL에 download 옵션을 붙여 만듭니다(`getPublicUrl(path, { download: true })`). 다른 출처 URL에는 `<a download>`가 듣지 않습니다.
- Storage 파일을 `fetch`로 받을 수 있는지(CORS) 렌더링 스파이크 때 함께 확인합니다.
- 공유 텍스트에는 공개 링크(`ref`만 있고 `league` 없음)를 넣습니다. 파일과 함께 보내면 텍스트를 버리는 앱이 많아서 영상 마지막 장면에도 URL을 넣습니다.

## 7. 영상

| 항목 | 값 |
|---|---|
| 규격 | 720×1280, 30fps, 10초, H.264, `-pix_fmt yuv420p`, `-movflags +faststart`, 무음 |
| 구성 | 희망(`meme.hope`) → 반전(결과 자막 윗줄 `top`과 소품) → 밈 결과(아랫줄 `bottom`, 순위, "BEAT ME!", 공개 챌린지 URL `/c/{challengeId}`, ref 없음). [게임 디자인](MEME_GAME_DESIGN.md) 5절 |
| 그림 | 게임과 같은 배경·캐릭터·소품 스프라이트를 FFmpeg으로 장면마다 겹침. 화면 녹화는 하지 않음 |
| 문구 | 밈 카드에서 가져옴. 코드에 고정 문구를 두지 않음 |
| 미리보기 | `<video playsinline muted>`. iOS에서 `playsinline`이 없으면 전체 화면으로 열림 |
| 실패 시 | 결과 카드 다운로드로 대체. 공개 referral(`invite: false`)을 만들고 `/api/og/{referralId}`를 받음. 기록은 영상 요청 전에 이미 저장되어 있음(AC-20) |

- 폰트 파일을 저장소에 넣고 배포에 포함합니다.
- Vercel에서 `ffmpeg-static`을 쓰면 Next.js 번들링에서 바이너리가 빠질 수 있습니다. 이때는 `serverExternalPackages`, `outputFileTracingIncludes` 설정이 필요할 수 있습니다. 함수 `maxDuration`도 넉넉히 잡습니다.

## 8. 이벤트

PRD §13.6 이름을 그대로 쓰고, 8개만 기록합니다.

| 이벤트 | 기록 위치 |
|---|---|
| `challenge_link_opened` | 클라이언트, 진입 시 |
| `game_started` | 서버, `POST /api/attempts` |
| `game_completed` | 서버, finish |
| `league_joined` | 서버, join |
| `video_generated` | 서버, videos |
| `video_downloaded` | 클라이언트 |
| `native_share_invoked` | 클라이언트 |
| `challenge_link_copied` | 클라이언트. 텍스트 복사도 포함(`meta.format: "text"`) |

추천 유입 여부(AC-16)는 별도 이벤트 대신 `referral_id`가 있는지로 구분합니다. 클라이언트는 URL의 `ref`를 상태로 들고 있다가 이벤트와 시작 요청에 함께 보냅니다.

## 9. 인수 기준 대응

| AC | 충족 방법 |
|---|---|
| 01 | 닉네임만 입력, 로그인 없음 |
| 02, 03 | 세 라운드가 끝나면 서버가 라운드별 오차와 합을 계산해 `attempts`에 저장하고 응답 |
| 04 | "Challenge a Friend" → `/api/referrals` (`invite: true`) |
| 05, 06 | `league` 토큰 → Join & Play → Friends 랭킹 |
| 07 | 쿠키 + `/api/me` (같은 브라우저 기준) |
| 08 | 결과 3가지(`win`, `lose`·`early`, `lose`·`late`)마다 다른 영상 |
| 09 | Storage 다운로드 URL |
| 10 | 기록과 유형별 문구를 영상에 합성 |
| 11 | Vercel HTTPS |
| 12 | `generateMetadata` + `/api/og` |
| 13 | 팀원 폰의 기본 브라우저 + Instagram 인앱 브라우저 |
| 14 | `canShare` 실패 시 다운로드·링크 복사 |
| 15 | `/c/{challengeId}` 라우트 |
| 16 | `attempts`·`events`의 `referral_id` 유무 |
| 17 | OG가 `league` 파라미터를 쓰지 않음, 리그 리더보드 API가 멤버 여부 확인 |
| 18 | 키는 서버 환경 변수에만, RLS 켜고 정책 없음 |
| 19 | 숨길 정답이 없는 게임이라 해당 없음. 대신 2절의 측정값 검증 |
| 20 | 기록을 먼저 저장, 렌더링 실패 시 결과 카드 |

## 10. 일정

MVP 코드는 동훈님 혼자 맡으므로, 위험이 큰 것부터 순서대로 진행합니다. 괄호 안 시각은 12:30에 시작한다고 가정한 값입니다.

| 시간 | 동훈님: MVP |
|---|---|
| 0:00–0:30 (12:30–13:00) | Next.js 생성, Vercel 배포, Supabase 테이블·뷰·버킷 생성. 첫날 밈 카드는 밈이 정해지는 대로 손으로 씀 |
| 0:30–1:15 (13:00–13:45) | 배포 환경에서 렌더링 스파이크: 고정값과 단색 배경으로 MP4 1개 |
| 1:15 (13:45) | **체크포인트**: 배포 환경에서 MP4가 나오는지 확인. 안 나오면 렌더링만 컨테이너로 분리 |
| 1:15–2:15 (13:45–14:45) | players, challenges, attempts(시작·종료·검증), me API + 게임 화면(타이머, 탭 판정) |
| 2:15–3:00 (14:45–15:30) | leagues, referrals, Friends·Global 랭킹 API + 결과 화면 랭킹 탭 |
| 3:00–3:45 (15:30–16:15) | 결과 3종 영상 완성, `/api/videos`, 공유·다운로드·텍스트 복사·fallback |
| 3:45–4:15 (16:15–16:45) | OG 메타·이미지, 이벤트 |
| 4:15–4:40 (16:45–17:10) | 실기기 테스트(Simon님과 폰 두 대로 데모 시나리오), 버그 수정 |
| 4:40–5:00 (17:10–17:30) | 기능 동결, 데모 리허설, 발표용 QR 코드와 서버 장애 대비 사전 녹화 영상 준비 |

Simon님은 PR #2 일정대로 발굴 로직을 진행하면서 아래 결과물을 시점에 맞춰 넘깁니다.

| 결과물 | 규격 | 필요 시점 |
|---|---|---|
| 게임 스프라이트 | [게임 디자인](MEME_GAME_DESIGN.md) 9절의 게임 아트(사무실 배경, 직장인 캐릭터 5동작, 보스 2동작, 시계, 문, 메일·회의 소품). 형식은 ASSET_FORMATS 3·4번 | 1:15 (13:45), 게임 화면 착수 전. 늦으면 도형으로 먼저 만들고 교체 |
| 영상 배경 2장과 반응 스티커 | 성공·실패 배경(ASSET_FORMATS 1번)과 결과별 반응 스티커(투명 PNG) | 3:00 (15:30) |
| OG 기본 이미지 | 1200×630 | 3:45 (16:15) |
| 데모의 B 역할 | 폰 한 대 | 4:15–5:00 (16:45–17:30) |

PR #2의 5단계(17:00, 사장님과 함께하는 선택 기록)가 MVP 실기기 테스트·리허설과 겹칩니다. 리허설 뒤로 옮길지 Simon님과 맞춰야 합니다.

### 밀릴 때 버리는 순서

2:15(14:45)에 게임과 기본 API가 끝나지 않았으면 1·2번을 바로 버립니다.

1. 인앱 브라우저 배너
2. 클라이언트 이벤트(AC-16은 `attempts.referral_id`로 계속 충족)
3. 동적 OG 이미지 → 정적 이미지(설명 문구의 기록은 유지)
4. 영상 파일 공유 → 다운로드만

끝까지 지키는 것: 서버 기록 검증, Global·Friends 랭킹, 결과 3종 영상, 링크 진입, AC-17·18

## 11. 남은 결정

- **첫날의 밈**: 목표 시간과 화면·영상 문구가 여기서 정해집니다. 게임 화면 착수(1:15, 13:45) 전에 정해야 합니다. 발굴 로직 결과를 기다리기 어려우면 사람이 고릅니다.
- **재도전 규칙**: 기본은 무제한 재도전에 최고 기록 인정입니다. PRD §8.2처럼 하루 한 번만 공식으로 치려면 `attempts`에 (player, challenge) 첫 기록만 인정하도록 바꿉니다.
- **Perfect 기준**: 합산 300ms, 라운드 반응 100ms는 가정입니다. 게임 화면이 붙으면(1:15–2:15) 몇 번 해 보고 조정합니다.
- **언어**: 심사를 한국어로 하면 영어 대신 한국어로 바꿉니다. 영상에 한글을 넣으려면 한글 폰트가 필요합니다.
- **렌더링 위치**: 1:15(13:45) 체크포인트 결과로 정합니다.
