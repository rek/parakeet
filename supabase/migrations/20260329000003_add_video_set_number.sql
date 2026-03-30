-- Add set_number to session_videos for per-set video association.
-- Existing rows backfill to set 1 (the default).
alter table session_videos
  add column set_number integer not null default 1;

alter table session_videos
  add constraint chk_set_number_positive check (set_number > 0);

-- Replace the old index with one that includes set_number.
drop index if exists idx_session_videos_session_lift_angle;

create index idx_session_videos_session_lift_set_angle
  on session_videos(session_id, lift, set_number, camera_angle);
