ALTER TABLE auxiliary_assignments
  ADD COLUMN IF NOT EXISTS exercise_1_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exercise_2_locked boolean NOT NULL DEFAULT false;
