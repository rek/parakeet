-- Add auxiliary_sets column to session_logs
-- Stores actual auxiliary exercise sets logged during a session (JSONB array).
-- NULL for sessions logged before this feature was added.
ALTER TABLE session_logs
  ADD COLUMN IF NOT EXISTS auxiliary_sets JSONB;
