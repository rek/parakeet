-- Motivational message LLM call logs
create table if not exists motivational_message_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_ids uuid[] not null,
  context jsonb not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table motivational_message_logs enable row level security;

create policy "Users can read own motivational logs"
  on motivational_message_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own motivational logs"
  on motivational_message_logs for insert
  with check (auth.uid() = user_id);

create index idx_motivational_message_logs_user_created
  on motivational_message_logs (user_id, created_at desc);
