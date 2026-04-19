-- Backlog #16 Phase C — drop the JSONB per-set columns from session_logs.
--
-- `set_logs` is the authoritative store for per-set data (introduced in
-- 20260417000000_create_set_logs.sql). Every reader has been cut over to
-- `fetchSessionSetsBySessionIds`; the last writers (the app's
-- `insertSessionLog` placeholders and `tools/scripts/import-csv.ts`) were
-- removed in the same commit that adds this migration.
--
-- Apply only after all clients are on the build that stops sending these
-- fields. For this project we control the only deployed clients, so the
-- rollout gate is controlled directly rather than via a soak period.

BEGIN;

ALTER TABLE public.session_logs DROP COLUMN IF EXISTS actual_sets;
ALTER TABLE public.session_logs DROP COLUMN IF EXISTS auxiliary_sets;

COMMIT;
