-- Server-side elapsed time for an attempt, measured on the DB clock (MVP_SCOPE 2절 "측정·검증").
-- Run once in Supabase → SQL Editor after 0001_init.sql.
create or replace function attempt_server_elapsed_ms(p_attempt uuid)
returns integer
language sql
stable
as $$
  select (extract(epoch from (now() - started_at)) * 1000)::int
  from attempts
  where id = p_attempt;
$$;

revoke execute on function attempt_server_elapsed_ms(uuid) from public, anon, authenticated;
grant execute on function attempt_server_elapsed_ms(uuid) to service_role;
