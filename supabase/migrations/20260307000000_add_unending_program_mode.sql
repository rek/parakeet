-- Add unending program mode support
ALTER TABLE programs
  ADD COLUMN program_mode TEXT NOT NULL DEFAULT 'scheduled',
  ADD COLUMN unending_session_counter INTEGER NOT NULL DEFAULT 0;

ALTER TABLE programs
  ADD CONSTRAINT programs_program_mode_check
    CHECK (program_mode IN ('scheduled', 'unending'));

-- total_weeks is meaningless for unending programs
ALTER TABLE programs
  ALTER COLUMN total_weeks DROP NOT NULL;
