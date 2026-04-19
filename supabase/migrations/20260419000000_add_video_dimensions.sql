-- Native pixel dimensions of the recorded video, captured at insert time
-- via getVideoMetaData. Needed by the playback overlay to compute the
-- letterbox/pillarbox display rect — overlays drawn in normalised 0..1
-- coordinates must match the actual video display rect inside the
-- contentFit="contain" container, not the container rect itself.
--
-- Nullable: existing rows have no dimensions; the overlay falls back to the
-- container rect with a sub-label warning that alignment may be off.
alter table session_videos
  add column if not exists video_width_px integer,
  add column if not exists video_height_px integer;

comment on column session_videos.video_width_px is
  'Native video width in pixels. Used by playback overlay for letterbox math.';
comment on column session_videos.video_height_px is
  'Native video height in pixels. Used by playback overlay for letterbox math.';
