-- Rename the rehab-stamp trigger's local variable away from `session_user`.
--
-- `session_user` is a PostgreSQL built-in (returns the original logged-in
-- role as `name` type). Inside the embedded SQL queries in this plpgsql
-- function, the unqualified identifier resolves to the built-in instead of
-- the declared local — comparison becomes `uuid = name` and the planner
-- rejects it with "operator does not exist: uuid = name".
--
-- The bug only surfaces when the function is invoked from a SQL context
-- that re-parses the embedded query against the live session state (e.g.,
-- the supabase CLI's Management API queries, or any direct-SQL backfill).
-- Day-to-day PostgREST inserts happen via a code path where plpgsql's
-- parameter binding short-circuits the lookup, so production inserts are
-- unaffected — but that's fragile.
--
-- Discovered while backfilling a lost session manually for user
-- 73d410b4 on 2026-05-27.

create or replace function stamp_set_log_during_rehab() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_user_id uuid;
  v_lift text;
  cap_count int;
begin
  select user_id, primary_lift
    into v_user_id, v_lift
    from sessions
   where id = NEW.session_id;

  if v_lift is null then
    return NEW;
  end if;

  select count(*)
    into cap_count
    from rehab_caps
   where user_id = v_user_id
     and lift = v_lift
     and ended_at is null;

  if cap_count > 0 then
    NEW.during_rehab := true;
  end if;

  return NEW;
end;
$$;

notify pgrst, 'reload schema';
