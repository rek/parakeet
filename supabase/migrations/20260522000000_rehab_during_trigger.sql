-- Server-stamp set_logs.during_rehab from rehab_caps state at insert time.
--
-- The `during_rehab` boolean is set TRUE iff the parent session has a
-- primary_lift AND the user has an active rehab cap (rehab_caps.ended_at IS NULL)
-- for that lift at the moment the set is logged. The trigger ignores
-- whatever the client sent — drift between UI cache and DB state can't
-- bypass the flag.
--
-- `pain_limited` stays as a client-supplied value (the user's RPE pill choice).
-- Only `during_rehab` is stamped here; the column's default false applies
-- when no cap is active.
--
-- See docs/features/rehab-mode/spec-app.md.

create function stamp_set_log_during_rehab() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  session_user uuid;
  session_lift text;
  cap_count int;
begin
  -- Resolve the parent session's user_id + primary_lift. If the session
  -- has no primary_lift (ad-hoc / non-program), nothing to stamp.
  select user_id, primary_lift
    into session_user, session_lift
    from sessions
   where id = NEW.session_id;

  if session_lift is null then
    return NEW;
  end if;

  -- Is there an active rehab cap for this user × lift?
  select count(*)
    into cap_count
    from rehab_caps
   where user_id = session_user
     and lift = session_lift
     and ended_at is null;

  if cap_count > 0 then
    NEW.during_rehab := true;
  end if;

  return NEW;
end;
$$;

create trigger set_logs_stamp_during_rehab
  before insert or update on public.set_logs
  for each row
  execute function stamp_set_log_during_rehab();

notify pgrst, 'reload schema';
