-- Tighten the rehab stamp trigger: INSERT-only.
--
-- The previous trigger (20260522000000) fired on BEFORE INSERT OR UPDATE,
-- which had a subtle bug: if a set was logged BEFORE a rehab cap existed,
-- then later something updated the row (rest time correction, etc.), the
-- trigger would re-stamp `during_rehab = true` after the fact — even though
-- the set was a normal clean set at the time it was logged. Once stamped,
-- the set would be excluded from working-1RM / PR detection forever.
--
-- Sets are intrinsically tied to the cap-state at insert time. Drop the
-- UPDATE branch so existing rows are immutable WRT during_rehab.
--
-- See GH#220 + Phase 3 review.

drop trigger if exists set_logs_stamp_during_rehab on public.set_logs;

create trigger set_logs_stamp_during_rehab
  before insert on public.set_logs
  for each row
  execute function stamp_set_log_during_rehab();
