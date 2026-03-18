-- Prevent duplicate planned/in_progress sessions for the same program slot.
-- Duplicates cause multiple workout cards to appear for the same day in the UI.

BEGIN;

-- Step 1: Remove duplicate non-completed sessions, keeping the oldest (by created_at).
-- Safety: never delete a session that already has session_logs entries.
DELETE FROM sessions
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY program_id, week_number, day_number
        ORDER BY created_at ASC
      ) AS rn
    FROM sessions
    WHERE
      status IN ('planned', 'in_progress')
      AND program_id IS NOT NULL
  ) ranked
  WHERE rn > 1
)
AND id NOT IN (
  SELECT DISTINCT session_id FROM session_logs
);

-- Step 2: Enforce uniqueness going forward.
-- Only applies to active sessions (planned or in_progress) with a real program_id.
-- Completed and skipped sessions are excluded so historical records are unaffected.
-- Ad-hoc sessions (program_id IS NULL) are also excluded — they have no slot identity.
CREATE UNIQUE INDEX sessions_unique_active_slot
  ON sessions (program_id, week_number, day_number)
  WHERE program_id IS NOT NULL
    AND status IN ('planned', 'in_progress');

COMMIT;
