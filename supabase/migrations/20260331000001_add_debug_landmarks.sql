-- Debug column: stores raw PoseFrame[] landmarks from on-device MediaPipe.
-- Only populated in dev builds. Nullable, no RLS impact.
-- Used by scripts/pull-device-analysis.ts to feed device landmarks into
-- the calibration test harness for comparison with Python-extracted fixtures.
alter table session_videos
  add column if not exists debug_landmarks jsonb;

comment on column session_videos.debug_landmarks is
  'Raw MediaPipe PoseFrame[] from device. Dev-only. Used for calibration test harness.';
