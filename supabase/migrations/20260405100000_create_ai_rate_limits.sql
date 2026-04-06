-- Rate limiting table for AI proxy Edge Function
create table ai_rate_limits (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Index for efficient per-user window queries
create index idx_ai_rate_limits_user_window
  on ai_rate_limits (user_id, created_at desc);

-- RLS: users cannot read/write this table directly — only the Edge Function
-- (using service role key) accesses it
alter table ai_rate_limits enable row level security;

-- Auto-cleanup: delete rows older than 2 hours (cron or manual)
-- For now, the Edge Function only queries the last hour window.
-- A pg_cron job can be added later to purge old rows.
