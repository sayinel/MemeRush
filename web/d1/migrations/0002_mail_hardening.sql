-- Mail hardening: double opt-in state, duplicate-inbox key, suppression list, rate-limit counters.
-- Rows that exist before this migration become 'pending' (their consent was never confirmed by a link).

alter table email_subscribers add column status text not null default 'pending' check (status in ('pending', 'active'));
alter table email_subscribers add column norm_email text; -- lower case, +tag removed, Gmail dots removed
alter table email_subscribers add column confirmed_at text;
alter table email_subscribers add column confirm_sent_at text;
create unique index email_subscribers_norm_key on email_subscribers (norm_email) where norm_email is not null;

-- Addresses that must never be mailed again (unsubscribed, bounced, complained). Only a keyed hash
-- ("<keyVersion>:<HMAC>") is stored, never the address itself.
create table email_suppressions (
  hash text primary key,
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Fixed-window request counters (key = "ip:<hash>" or "em:<hash>", never a clear IP or address).
create table rate_limits (
  key text primary key,
  window_start integer not null,
  count integer not null
);
