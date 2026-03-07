-- Allow sessions with no program (historical imports)
ALTER TABLE sessions ALTER COLUMN program_id DROP NOT NULL;

-- Add 'import' as a valid intensity_type sentinel for imported sessions
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_intensity_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_intensity_type_check
  CHECK (intensity_type = ANY (ARRAY['heavy', 'explosive', 'rep', 'deload', 'import']));
