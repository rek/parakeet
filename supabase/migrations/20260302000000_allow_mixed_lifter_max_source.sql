-- Allow mixed 1RM/3RM submissions across lifts in a single lifter_maxes row.
-- This keeps per-lift input independent (e.g. squat=1RM, bench=3RM, deadlift=1RM).

ALTER TABLE lifter_maxes
  DROP CONSTRAINT IF EXISTS lifter_maxes_source_check;

ALTER TABLE lifter_maxes
  ADD CONSTRAINT lifter_maxes_source_check
  CHECK (source IN ('input_1rm', 'input_3rm', 'mixed', 'system_calculated'));
