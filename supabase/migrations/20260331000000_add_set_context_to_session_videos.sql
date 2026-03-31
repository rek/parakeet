-- Snapshot set-level context (weight, reps, RPE) onto session_videos.
-- Replaces the "max-weight heuristic" in coaching context assembly
-- with precise per-set data captured at video recording time.
-- Nullable for backward compatibility and partner-recorded videos
-- (recorder doesn't have access to lifter's actual set data).

ALTER TABLE session_videos ADD COLUMN set_weight_grams integer;
ALTER TABLE session_videos ADD COLUMN set_reps integer;
ALTER TABLE session_videos ADD COLUMN set_rpe numeric(3,1);
