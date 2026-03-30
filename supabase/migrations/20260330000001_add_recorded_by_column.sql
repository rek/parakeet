-- Add recorded_by to session_videos for gym partner filming.
-- NULL means self-recorded (backward compatible with all existing rows).
alter table session_videos
  add column recorded_by uuid references profiles(id);
