-- Add coaching_response column to session_videos for LLM form coaching results.
-- Stored separately from analysis (which is CV-computed) because coaching
-- is LLM-generated and may be re-requested with different context.
alter table session_videos
  add column coaching_response jsonb;
