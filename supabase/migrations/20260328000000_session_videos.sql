-- Video form analysis: store video references and analysis results per session + lift
create table session_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  session_id uuid references sessions(id) not null,
  lift text not null,
  local_uri text not null,
  remote_uri text,
  duration_sec integer not null,
  analysis jsonb,
  created_at timestamptz default now() not null
);

alter table session_videos enable row level security;

create policy "Users can read own videos"
  on session_videos for select using (auth.uid() = user_id);

create policy "Users can insert own videos"
  on session_videos for insert with check (auth.uid() = user_id);

create policy "Users can update own videos"
  on session_videos for update using (auth.uid() = user_id);

create policy "Users can delete own videos"
  on session_videos for delete using (auth.uid() = user_id);

create index idx_session_videos_session on session_videos(session_id);
create index idx_session_videos_user_lift on session_videos(user_id, lift);
