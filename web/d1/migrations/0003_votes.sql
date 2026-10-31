-- Next-game vote (newsletter). One vote per ref: a subscriber ref from the mail link, or "anon:<cookie id>".
-- Pressing again changes the choice (upsert on ref).
create table votes (
  id integer primary key autoincrement,
  ref text not null,
  choice text not null check (choice in ('dalgona', 'ufo', 'fishing')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create unique index votes_ref_key on votes (ref);
