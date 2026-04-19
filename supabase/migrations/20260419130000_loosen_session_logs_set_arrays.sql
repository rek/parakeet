-- Backlog #16 Phase A — loosen the NOT NULL constraint on the dying
-- session_logs.actual_sets / auxiliary_sets JSONB columns so the next
-- client build can stop sending placeholder `[]` / `null` values.
--
-- Backward-compatible. Both columns remain present until Migration B
-- (20260419140000_drop_session_logs_set_arrays.sql) drops them once all
-- clients have rolled over. See:
--   docs/features/session/design-durability.md
--   tools/scripts/pending-drop-session-logs-jsonb.md (archived after drop)

BEGIN;

ALTER TABLE public.session_logs
  ALTER COLUMN actual_sets DROP NOT NULL,
  ALTER COLUMN actual_sets SET DEFAULT '[]'::jsonb;

COMMIT;
