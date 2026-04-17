-- Backfill set_logs from existing session_logs.actual_sets / auxiliary_sets.
-- Idempotent: unique index on (session_id, kind, exercise, set_number) with
-- NULLS NOT DISTINCT collapses repeat rows. Safe to re-run.
--
-- Run once after pushing 20260417000000_create_set_logs.sql to hosted. Can be
-- applied via Supabase dashboard SQL editor or psql.

BEGIN;

-- Primary sets: one row per entry in session_logs.actual_sets.
INSERT INTO set_logs (
  session_id,
  user_id,
  kind,
  exercise,
  set_number,
  weight_grams,
  reps_completed,
  rpe_actual,
  actual_rest_seconds,
  exercise_type,
  failed,
  notes,
  logged_at
)
SELECT
  sl.session_id,
  sl.user_id,
  'primary'::text,
  NULL,
  (s->>'set_number')::int,
  (s->>'weight_grams')::int,
  (s->>'reps_completed')::int,
  NULLIF(s->>'rpe_actual', '')::numeric,
  NULLIF(s->>'actual_rest_seconds', '')::int,
  NULL,
  COALESCE((s->>'failed')::boolean, false),
  s->>'notes',
  COALESCE(sl.completed_at, sl.logged_at)
FROM session_logs sl,
     jsonb_array_elements(COALESCE(sl.actual_sets, '[]'::jsonb)) AS s
WHERE (s->>'set_number') IS NOT NULL
ON CONFLICT (session_id, kind, exercise, set_number) DO NOTHING;

-- Auxiliary sets: one row per entry in session_logs.auxiliary_sets (if any).
INSERT INTO set_logs (
  session_id,
  user_id,
  kind,
  exercise,
  set_number,
  weight_grams,
  reps_completed,
  rpe_actual,
  actual_rest_seconds,
  exercise_type,
  failed,
  notes,
  logged_at
)
SELECT
  sl.session_id,
  sl.user_id,
  'auxiliary'::text,
  s->>'exercise',
  (s->>'set_number')::int,
  (s->>'weight_grams')::int,
  (s->>'reps_completed')::int,
  NULLIF(s->>'rpe_actual', '')::numeric,
  NULLIF(s->>'actual_rest_seconds', '')::int,
  s->>'exercise_type',
  COALESCE((s->>'failed')::boolean, false),
  s->>'notes',
  COALESCE(sl.completed_at, sl.logged_at)
FROM session_logs sl,
     jsonb_array_elements(COALESCE(sl.auxiliary_sets, '[]'::jsonb)) AS s
WHERE (s->>'set_number') IS NOT NULL
  AND (s->>'exercise') IS NOT NULL
ON CONFLICT (session_id, kind, exercise, set_number) DO NOTHING;

-- Verification: should equal sum of array lengths across session_logs.
SELECT
  (SELECT count(*) FROM set_logs)                    AS set_logs_total,
  (SELECT SUM(jsonb_array_length(COALESCE(actual_sets, '[]'::jsonb)))
     FROM session_logs)                              AS primary_expected,
  (SELECT SUM(jsonb_array_length(COALESCE(auxiliary_sets, '[]'::jsonb)))
     FROM session_logs)                              AS aux_expected;

COMMIT;
