-- Add unending program mode support (IF NOT EXISTS — safe to re-run if columns already exist on prod)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS program_mode TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE programs ADD COLUMN IF NOT EXISTS unending_session_counter INTEGER NOT NULL DEFAULT 0;

ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_program_mode_check;
ALTER TABLE programs ADD CONSTRAINT programs_program_mode_check
  CHECK (program_mode IN ('scheduled', 'unending'));

-- total_weeks is meaningless for unending programs
ALTER TABLE programs ALTER COLUMN total_weeks DROP NOT NULL;

-- Add 'missed' status (was in older migrations before squash, safe to re-apply)
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status = ANY (ARRAY['planned','in_progress','completed','skipped','missed']));
