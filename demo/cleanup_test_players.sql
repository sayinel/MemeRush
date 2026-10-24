-- Removes the test players created while building (not inel / Simon / fit*). Run once in the Supabase SQL Editor.
-- Order follows the foreign keys: events → attempts → league_members → referrals → leagues → players.
-- Video files in the `videos` bucket are not removed by this (Storage blocks direct SQL deletes); they are harmless.
begin;

create temp table test_players on commit drop as
select id from players
where nickname in ('e2e_A', 'e2e_B', 'e2e_C', 'e2e_prod', 'ui_Dana', 'ui_Sam', 'ui_Jo', 'og_test', 'vid_test', 'vid_prod');

create temp table test_leagues on commit drop as
select id from leagues where owner_id in (select id from test_players);

create temp table test_referrals on commit drop as
select id from referrals
where source_player_id in (select id from test_players) or league_id in (select id from test_leagues);

delete from events
where player_id in (select id from test_players) or referral_id in (select id from test_referrals);
delete from attempts
where player_id in (select id from test_players) or referral_id in (select id from test_referrals);
delete from league_members
where player_id in (select id from test_players) or league_id in (select id from test_leagues);
delete from referrals where id in (select id from test_referrals);
delete from leagues where id in (select id from test_leagues);
delete from players where id in (select id from test_players);

select nickname from players order by created_at; -- what is left
commit;
