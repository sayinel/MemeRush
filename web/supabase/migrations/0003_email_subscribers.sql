-- Email CTA subscribers (replaces the local JSONL file). Not applied automatically.
-- All access goes through the Next.js API with the service-role key; RLS on, no policies = no direct client access.
create table email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) <= 254),
  lang text not null default 'en',
  source text,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

-- Addresses are stored lower-cased by the API; the unique index also guards against case variants.
create unique index email_subscribers_email_key on email_subscribers (lower(email));

alter table email_subscribers enable row level security;
