-- Add camera_angle column to session_videos for front/side view distinction.
-- Defaults to 'side' for all existing videos (Phase 1+2 were side-view only).
-- Allows multiple videos per session/lift (one side + one front).
alter table session_videos
  add column camera_angle text not null default 'side';

-- Drop the implicit uniqueness assumption (one video per session/lift)
-- and add an index that covers the new (session_id, lift, camera_angle) tuple.
create index idx_session_videos_session_lift_angle
  on session_videos(session_id, lift, camera_angle);
