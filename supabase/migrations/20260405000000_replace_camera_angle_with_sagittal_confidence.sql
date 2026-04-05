-- Replace binary camera_angle with continuous sagittal_confidence (0-1).
-- See mobile-052: view angle rework.

-- Add new column
ALTER TABLE session_videos ADD COLUMN sagittal_confidence real DEFAULT 0.8;

-- Backfill from existing camera_angle
UPDATE session_videos SET sagittal_confidence = CASE
  WHEN camera_angle = 'side' THEN 0.9
  WHEN camera_angle = 'front' THEN 0.1
  ELSE 0.8
END;

-- Drop old column
ALTER TABLE session_videos DROP COLUMN camera_angle;
