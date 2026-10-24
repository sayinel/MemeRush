# MemeRush MVP 범위 확정본

- 기준: PRD v0.3 (2026-10-24). 이 문서와 PRD가 다르면 이 문서를 따릅니다.
- 조건: 2명, 5시간
- 데모 시나리오: A 플레이 → 결과 화면에서 "Challenge a Friend" → B가 미리보기를 확인하고 링크 열기 → B가 리그에 참여해 플레이 → 같은 리그 리더보드에 두 사람 표시 → 두 사람이 각자 점수에 맞는 MP4 저장·공유

이 시나리오에 필요 없는 기능은 모두 보류합니다.

## 1. 범위

| 구분 | 항목 |
|---|---|
| 유지 | 챌린지 1개 · 닉네임 + 익명 세션 · 서버 채점과 첫 제출만 인정 · 리그 자동 생성과 초대 링크 · 리그 리더보드와 점수 차이 · OG 메타와 동적 미리보기 이미지 · 영상 2종, MP4 다운로드·파일 공유 · fallback(결과 카드, 링크 복사) · 이벤트 기록 |
| 보류 | 한국어 · 앱 실행 중 AI 생성 · AI Meme Director(FR-V05) · Friend Rivalry, Almost a Legend · Weekly League, Streak · PlatformIdentity, VideoExport · `/api/platform/config` · Telegram, Discord, TikTok 연동 |

## 2. 결정 사항

PRD에서 비어 있거나 절마다 어긋나던 항목입니다.

| 항목 | 결정 | 관련 PRD |
|---|---|---|
| 언어 | 영어만 | FR-G05 |
| AI 게임 생성 | 스크립트로 챌린지 JSON을 미리 생성하고, 사람이 검토한 뒤 커밋. 앱 실행 중에는 생성하지 않음 | FR-G06, §8.3 |
| 챌린지 | 1개 고정, ID `2026-10-24`. DB가 아니라 `content/challenges/2026-10-24.json`에 둠 | §8.1 |
| 사용자 식별 | 익명. 닉네임을 입력하면 서버가 httpOnly 쿠키 `mr_pid`(플레이어 UUID)를 발급. 같은 브라우저 안에서만 같은 사용자로 취급 | §7.4, AC-07 |
| 답안 제출 | 5문항을 끝에 한 번에 제출. 문제별 정답 표시 없이 결과 화면에서 해설 | AC-19 |
| 공식 점수 | 정답 수 × 200점. 플레이어·챌린지당 첫 제출만 저장하고, 다시 제출하면 기존 결과를 돌려줌 | §8.2 |
| 동점 | 같은 순위(1, 1, 3). 표시 순서는 먼저 완료한 사람이 위 | — |
| 점수 차이 | 1위와의 차이. 내가 1위면 2위보다 앞선 점수 | FR-C04 |
| 리그 | 1인 1리그. "Challenge a Friend"를 처음 누를 때 자동 생성하고 만든 사람을 멤버로 넣음. 한 사람이 여러 리그에 속할 수 있음 | §9.1 |
| 리그 참여 | 초대 링크로 들어온 사람은 "Join {owner}'s league & play" 버튼을 눌러야 참여. 이 버튼이 명시적 동의 | §9.2 |
| 결과 화면의 리그 | URL의 리그 → 내가 만든 리그 → 참여한 첫 리그 순으로 하나를 표시 | §3.4 |
| 링크 | 공개: `/c/{challengeId}?ref={referralId}` · 리그 초대: 같은 주소 + `&league={inviteToken}` | §5.2, §9.2 |
| 미리보기 | OG 생성에 `league` 파라미터를 쓰지 않음. 공유한 사람 본인 점수만 표시하고 닉네임·리그 정보는 넣지 않음 | AC-17 |
| 영상 유형 | 600점 이상 Victory Flex, 미만 Self-Roast | §3.5, §9.3 |
| 영상 생성 | 동기 처리. 요청 하나에서 렌더링 → 업로드 → URL 반환. 렌더링이 15초를 넘으면 그때 비동기로 전환 | §10.4 |
| DB 접근 | 모든 DB 접근은 Next.js API에서 service role 키로 함. 클라이언트에는 Supabase 키를 두지 않음. 모든 테이블에 RLS를 켜고 정책은 만들지 않음 | AC-18 |
| 호스팅 | Vercel 기본. 1:30 체크포인트에서 배포 환경 렌더링이 안 되면 렌더링만 컨테이너(Railway·Fly·Render 중 하나)로 분리 | §12.1 |

## 3. 챌린지 JSON

```json
{
  "id": "2026-10-24",
  "title": "Meme Decoder #001",
  "questions": [
    {
      "id": "q1",
      "prompt": "What does this meme usually mean?",
      "image": "/memes/q1.png",
      "options": ["...", "...", "...", "..."],
      "answerIndex": 2,
      "explanation": "One or two sentences."
    }
  ]
}
```

- `questions`는 정확히 5개, `options`는 정확히 4개, `answerIndex`는 0–3
- `image`는 선택. 없으면 텍스트 문제
- 생성 스크립트와 서버 로딩 양쪽에서 같은 스키마(zod)로 검증
- 밈 이미지는 직접 만든 것이나 CC0만 사용

## 4. DB

```sql
create table players (
  id uuid primary key default gen_random_uuid(),
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
  answers int[] not null,
  correct_count int not null,
  score int not null,
  referral_id text references referrals(id),   -- null이면 일반 유입
  video_type text,                             -- 'victory_flex' | 'self_roast'
  video_path text,                             -- Storage 경로
  completed_at timestamptz not null default now(),
  unique (player_id, challenge_id)
);

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

Storage: 공개 버킷 `videos`, 경로 `{challengeId}/{playerId}.mp4`

## 5. API

플레이어는 `mr_pid` 쿠키로 식별합니다. 쿠키가 필요한 API에 쿠키가 없으면 401입니다.

| 메서드 | 경로 | 요청 | 응답 | 비고 |
|---|---|---|---|---|
| POST | `/api/players` | `{ nickname }` | `{ playerId, nickname }` | 쿠키 발급. 쿠키가 있으면 닉네임만 갱신 |
| GET | `/api/challenges/{id}` | — | `{ id, title, questions: [{ id, prompt, image?, options }] }` | `answerIndex`, `explanation` 제외 |
| POST | `/api/challenges/{id}/submit` | `{ answers: number[5], ref? }` | `{ score, correctCount, results: [{ answerIndex, correct, explanation }], videoType, alreadySubmitted }` | 첫 제출만 저장. 유효하지 않은 `ref`는 무시 |
| GET | `/api/me?challengeId=` | — | `{ player?, attempt?, leagues: [{ leagueId, ownerNickname, isOwner }] }` | 재방문 시 화면 결정. 쿠키 없으면 빈 값 |
| GET | `/api/leagues/invites/{token}` | — | `{ leagueId, ownerNickname, memberCount }` | 인트로 화면 표시용 |
| POST | `/api/leagues/join` | `{ inviteToken }` | `{ leagueId }` | 이미 멤버면 그대로 성공 |
| GET | `/api/leagues/{leagueId}/leaderboard?challengeId=` | — | `{ rows: [{ nickname, score, rank, isMe }], myRank, gap }` | 멤버만 조회. 플레이한 멤버만 표시 |
| POST | `/api/referrals` | `{ challengeId, invite: boolean }` | `{ url }` | 완료한 사람만. `invite`면 리그가 없을 때 만들고 `league` 토큰을 붙임 |
| POST | `/api/videos` | `{ challengeId }` | `{ url, downloadUrl, type }` | 완료한 사람만. 이미 있으면 기존 URL |
| GET | `/api/og/{referralId}` | — | 1200×630 PNG | 결과 카드 다운로드에도 사용 |
| POST | `/api/events` | `{ type, challengeId, ref?, meta? }` | 204 | 클라이언트 이벤트용 |

## 6. 화면

라우트는 `/c/[challengeId]` 하나이고, `/`는 여기로 리다이렉트합니다.

1. **인트로**: 제목, 리그 초대면 "{owner}'s league" 표시, 쿠키가 없을 때만 닉네임 입력, 시작 버튼(리그 초대면 "Join & Play")
2. **게임**: 문항을 하나씩 표시, 진행 상태, 선택하면 바로 다음 문항
3. **결과**: 점수·정답 수 → 리더보드(리그가 없으면 "Challenge a Friend" 안내) → 영상(생성 → 미리보기 → 저장·공유) → 공유 버튼 → 해설

- 이미 플레이한 사람은 인트로 없이 결과로 갑니다. 리그 초대 링크로 왔는데 아직 멤버가 아니면 결과 화면에 Join 버튼을 띄웁니다.
- 인앱 브라우저(UA에 Instagram, FBAN, FBAV, TikTok 등)에서는 상단에 "영상 저장이 안 되면 외부 브라우저로 열기" 배너를 띄웁니다. UA는 이 표시에만 씁니다.

### 미리보기 (OG)

- `/c/[challengeId]`의 `generateMetadata`에서 `ref`가 유효하면 설명 "I scored {score}/1000. Can you beat me?"와 이미지 `/api/og/{ref}`를 씁니다. 아니면 기본 설명과 `/og-default.png`를 씁니다.
- 이미지 URL은 절대 경로로 씁니다. 크롤러는 JS를 실행하지 않습니다.

### 공유

- 영상이 준비되면 바로 `fetch`해서 `File`로 만들어 둡니다. 버튼을 누른 뒤에 받으면 iOS에서 사용자 동작으로 인정되지 않아 공유가 거부될 수 있습니다.
- `navigator.canShare({ files })`가 참이면 `navigator.share({ files, text })`, 아니면 다운로드 링크와 링크 복사를 보여 줍니다.
- 다운로드 링크는 Storage 공개 URL에 download 옵션을 붙여 만듭니다(`getPublicUrl(path, { download: true })`). 다른 출처 URL에는 `<a download>`가 듣지 않습니다.
- Storage 파일을 `fetch`로 받을 수 있는지(CORS) 렌더링 스파이크 때 함께 확인합니다.
- 공유 텍스트에는 공개 링크(`ref`만 있고 `league` 없음)를 넣습니다. 파일과 함께 보내면 텍스트를 버리는 앱이 많아서 영상 마지막 장면에도 URL을 넣습니다.

## 7. 영상

| 항목 | 값 |
|---|---|
| 규격 | 720×1280, 30fps, 10초, H.264, `-pix_fmt yuv420p`, `-movflags +faststart`, 무음 |
| 구성 | 0–3초 훅 · 3–7초 펀치라인 + `{score}/1000` · 7–10초 CTA + 공개 챌린지 URL(`/c/{challengeId}`, ref 없음) |
| 배경 | 유형별 밈 이미지 1장에 `zoompan`으로 움직임 |
| 문구 | 유형별 고정 문구에 점수만 넣음 |
| 미리보기 | `<video playsinline muted>`. iOS에서 `playsinline`이 없으면 전체 화면으로 열림 |
| 실패 시 | 결과 카드 다운로드로 대체. 공개 referral(`invite: false`)을 만들고 `/api/og/{referralId}`를 받음. 점수는 영상 요청 전에 이미 저장되어 있음(AC-20) |

- 폰트 파일을 저장소에 넣고 배포에 포함합니다.
- Vercel에서 `ffmpeg-static`을 쓰면 Next.js 번들링에서 바이너리가 빠질 수 있습니다. 이때는 `serverExternalPackages`, `outputFileTracingIncludes` 설정이 필요할 수 있습니다. 함수 `maxDuration`도 넉넉히 잡습니다.

## 8. 이벤트

PRD §13.6 이름을 그대로 쓰고, 8개만 기록합니다.

| 이벤트 | 기록 위치 |
|---|---|
| `challenge_link_opened` | 클라이언트, 진입 시 |
| `game_started` | 클라이언트 |
| `game_completed` | 서버, submit |
| `league_joined` | 서버, join |
| `video_generated` | 서버, videos |
| `video_downloaded` | 클라이언트 |
| `native_share_invoked` | 클라이언트 |
| `challenge_link_copied` | 클라이언트 |

추천 유입 여부(AC-16)는 별도 이벤트 대신 `referral_id`가 있는지로 구분합니다. 클라이언트는 URL의 `ref`를 상태로 들고 있다가 이벤트와 submit에 함께 보냅니다.

## 9. 인수 기준 대응

| AC | 충족 방법 |
|---|---|
| 01 | 닉네임만 입력, 로그인 없음 |
| 02, 03 | submit API가 채점하고 `attempts`에 저장 |
| 04 | "Challenge a Friend" → `/api/referrals` (`invite: true`) |
| 05, 06 | `league` 토큰 → Join & Play → 리더보드 |
| 07 | 쿠키 + `/api/me` (같은 브라우저 기준) |
| 08 | 600점 기준 영상 2종 |
| 09 | Storage 다운로드 URL |
| 10 | 점수와 유형별 문구를 영상에 합성 |
| 11 | Vercel HTTPS |
| 12 | `generateMetadata` + `/api/og` |
| 13 | 팀원 폰의 기본 브라우저 + Instagram 인앱 브라우저 |
| 14 | `canShare` 실패 시 다운로드·링크 복사 |
| 15 | `/c/{challengeId}` 라우트 |
| 16 | `attempts`·`events`의 `referral_id` 유무 |
| 17 | OG가 `league` 파라미터를 쓰지 않음, 리더보드 API가 멤버 여부 확인 |
| 18 | 키는 서버 환경 변수에만, RLS 켜고 정책 없음 |
| 19 | 챌린지 응답에서 `answerIndex`·`explanation` 제외 |
| 20 | 점수를 먼저 저장, 렌더링 실패 시 결과 카드 |

## 10. 일정 (2명)

| 시간 | A: 화면·영상 | B: 서버·배포 |
|---|---|---|
| 0:00–0:30 | 챌린지 JSON 생성 스크립트 실행·검토, 밈 이미지 확보, 공용 타입 | Next.js 생성, Vercel 배포, Supabase 테이블·버킷 생성 |
| 0:30–1:30 | 배포 환경에서 렌더링 스파이크 → 영상 2종, `/api/videos` | players, challenges, submit, me API |
| 1:30 | **체크포인트**: 배포 환경에서 MP4가 나오는지 확인. 안 나오면 렌더링만 컨테이너로 분리 | 〃 |
| 1:30–2:45 | 인트로·게임·결과 화면(실제 API 연결) | referrals, leagues, leaderboard API, OG 메타·이미지 |
| 2:45–3:30 | 공유·다운로드·fallback, 인앱 배너 | events, 실기기 미리보기 테스트 |
| 3:30–4:15 | 함께: 폰 두 대로 데모 시나리오 통합 | 〃 |
| 4:15–4:40 | 함께: 실기기 테스트, 버그 수정 | 〃 |
| 4:40–5:00 | 기능 동결, 데모 리허설 | 〃 |

### 밀릴 때 버리는 순서

1. 결과 화면 해설
2. 인앱 브라우저 배너
3. 동적 OG 이미지 → 정적 이미지(설명 문구의 점수는 유지)
4. 영상 파일 공유 → 다운로드만
5. 클라이언트 이벤트(AC-16은 `attempts.referral_id`로 계속 충족)

끝까지 지키는 것: 서버 채점, 리그 리더보드, MP4 2종, 링크 진입, AC-17·18·19

## 11. 남은 결정

- **언어**: 심사를 한국어로 하면 영어 대신 한국어로 바꿉니다. 영상에 한글을 넣으려면 한글 폰트가 필요합니다.
- **렌더링 위치**: 1:30 체크포인트 결과로 정합니다.
