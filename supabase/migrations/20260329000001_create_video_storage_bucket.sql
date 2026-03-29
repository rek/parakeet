-- Create a Supabase Storage bucket for compressed lift videos.
-- Max 50MB per file (compressed 30s 1080p is typically 5-8MB).
-- RLS ensures users can only access their own videos via the user_id/ prefix.
insert into storage.buckets (id, name, public, file_size_limit)
values ('session-videos', 'session-videos', false, 52428800);

-- Users can upload to their own folder: session-videos/{user_id}/*
create policy "Users can upload own videos"
  on storage.objects for insert
  with check (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own videos
create policy "Users can read own videos"
  on storage.objects for select
  using (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own videos
create policy "Users can delete own videos"
  on storage.objects for delete
  using (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
