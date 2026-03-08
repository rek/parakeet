-- Make primary_lift nullable (allow NULL for free-form ad-hoc sessions)
ALTER TABLE sessions ALTER COLUMN primary_lift DROP NOT NULL;
ALTER TABLE sessions DROP CONSTRAINT sessions_primary_lift_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_primary_lift_check
  CHECK (primary_lift IS NULL OR primary_lift = ANY (ARRAY['squat','bench','deadlift']));

-- Make intensity_type nullable
ALTER TABLE sessions ALTER COLUMN intensity_type DROP NOT NULL;
ALTER TABLE sessions DROP CONSTRAINT sessions_intensity_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_intensity_type_check
  CHECK (intensity_type IS NULL OR intensity_type = ANY (ARRAY['heavy','explosive','rep','deload']));

-- Add optional activity name for free-form ad-hoc sessions
ALTER TABLE sessions ADD COLUMN activity_name TEXT;
