-- Cross-user RLS policies for gym partner filming.
-- These are ADDITIONAL policies — Postgres OR's same-type policies,
-- so existing self-access policies remain unchanged.

-- Partners can read partner's sessions (lift name, status, planned_sets for set picker).
-- CRITICAL: must use FOR SELECT — the existing users_own_data policy has no FOR clause.
-- A policy without FOR SELECT would also grant partners INSERT/UPDATE/DELETE.
create policy "Partners can read partner sessions"
  on sessions for select
  using (
    exists (
      select 1 from gym_partners
      where status = 'accepted'
      and (
        (requester_id = auth.uid() and responder_id = sessions.user_id)
        or (responder_id = auth.uid() and requester_id = sessions.user_id)
      )
    )
  );

-- No cross-user policy on session_logs — weights, RPE, failed flags stay private.
-- Set counts for the filming set picker come from sessions.planned_sets instead.

-- Partners can insert videos for the lifter.
-- Ensures: (a) recorder identifies themselves, (b) user_id is their accepted partner,
-- (c) session_id actually belongs to that user_id (defense-in-depth).
create policy "Partners can insert videos for lifter"
  on session_videos for insert
  with check (
    auth.uid() = recorded_by
    and exists (
      select 1 from gym_partners
      where status = 'accepted'
      and (
        (requester_id = auth.uid() and responder_id = session_videos.user_id)
        or (responder_id = auth.uid() and requester_id = session_videos.user_id)
      )
    )
    and exists (
      select 1 from sessions
      where id = session_videos.session_id
      and user_id = session_videos.user_id
    )
  );

-- Partners can upload compressed video to the lifter's storage folder.
create policy "Partners can upload to lifter folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'session-videos'
    and exists (
      select 1 from gym_partners
      where status = 'accepted'
      and (
        (requester_id = auth.uid() and responder_id::text = (storage.foldername(name))[1])
        or (responder_id = auth.uid() and requester_id::text = (storage.foldername(name))[1])
      )
    )
  );
