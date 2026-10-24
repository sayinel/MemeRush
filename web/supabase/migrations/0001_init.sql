-- MemeRush schema (docs/MVP_SCOPE.md 4절). Run once in Supabase → SQL Editor.

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

-- Public bucket for result videos: {challengeId}/{attemptId}.mp4
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;
