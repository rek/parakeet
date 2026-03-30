-- Gym partner pairing: persistent bidirectional partner relationships.
-- One pair per (A, B) regardless of who requested — enforced by LEAST/GREATEST unique index.

create table gym_partners (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id) not null,
  responder_id uuid references profiles(id) not null,
  status text not null default 'pending',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  constraint gym_partners_status_check
    check (status in ('pending', 'accepted', 'declined', 'removed')),
  constraint gym_partners_no_self_pair
    check (requester_id != responder_id)
);

-- Direction-agnostic unique: (A→B) and (B→A) treated as same pair.
-- Only enforced for active pairs — allows re-pairing after removal or decline.
create unique index idx_gym_partners_pair
  on gym_partners (least(requester_id, responder_id), greatest(requester_id, responder_id))
  where status in ('pending', 'accepted');

-- Fast lookups for accepted partners (used by partner list queries)
create index idx_gym_partners_requester on gym_partners(requester_id) where status = 'accepted';
create index idx_gym_partners_responder on gym_partners(responder_id) where status = 'accepted';

alter table gym_partners enable row level security;

-- Both sides can see their partnerships
create policy "Users can read own partnerships"
  on gym_partners for select
  using (auth.uid() = requester_id or auth.uid() = responder_id);

-- Only the requester can create a partnership request
create policy "Users can create partnership requests"
  on gym_partners for insert
  with check (auth.uid() = requester_id);

-- Responder can accept/decline; either side can remove/cancel
create policy "Responder can accept or decline"
  on gym_partners for update
  using (auth.uid() = responder_id and status = 'pending')
  with check (status in ('accepted', 'declined'));

create policy "Either side can remove"
  on gym_partners for update
  using (
    (auth.uid() = requester_id or auth.uid() = responder_id)
    and status in ('pending', 'accepted')
  )
  with check (status = 'removed');

-- Auto-update updated_at on any row change
create or replace function update_gym_partners_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_gym_partners_updated_at
  before update on gym_partners
  for each row execute function update_gym_partners_updated_at();

-- ============================================================
-- QR invite tokens: short-lived (5 min), single-use claim
-- ============================================================

create table gym_partner_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid references profiles(id) not null,
  token text not null unique default gen_random_uuid()::text,
  expires_at timestamptz not null,
  claimed_by uuid references profiles(id),
  created_at timestamptz default now() not null
);

alter table gym_partner_invites enable row level security;

create policy "Inviter and claimer can read invites"
  on gym_partner_invites for select
  using (auth.uid() = inviter_id or auth.uid() = claimed_by);

create policy "Users can create invites"
  on gym_partner_invites for insert
  with check (auth.uid() = inviter_id);

-- Any authenticated user can claim an unclaimed, unexpired invite.
-- USING restricts which rows (unclaimed + unexpired); WITH CHECK ensures
-- claimed_by is set to the caller's own ID only.
create policy "Authenticated users can claim unclaimed invites"
  on gym_partner_invites for update to authenticated
  using (claimed_by is null and expires_at > now())
  with check (claimed_by = auth.uid());

-- Claimer can unclaim their own invite (rollback on failed partnership insert
-- or self-claim detection). Setting claimed_by back to NULL re-enables the token.
create policy "Claimer can unclaim own invite"
  on gym_partner_invites for update to authenticated
  using (claimed_by = auth.uid())
  with check (claimed_by is null);

create policy "Inviter can delete own invites"
  on gym_partner_invites for delete
  using (auth.uid() = inviter_id);

-- Auto-cleanup: when a new invite is inserted, delete expired rows for the
-- same inviter to prevent unbounded accumulation of 5-minute TTL invites.
create or replace function cleanup_expired_invites()
returns trigger as $$
begin
  delete from gym_partner_invites
  where inviter_id = new.inviter_id
    and expires_at < now()
    and id != new.id;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_cleanup_expired_invites
  after insert on gym_partner_invites
  for each row execute function cleanup_expired_invites();

-- ============================================================
-- Storage: partner upload policies for session-videos bucket
-- ============================================================

-- Helper: check whether two users have an accepted partnership
create or replace function is_accepted_partner(p_user_id uuid, p_partner_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from gym_partners
    where status = 'accepted'
      and (
        (requester_id = p_user_id and responder_id = p_partner_id)
        or (requester_id = p_partner_id and responder_id = p_user_id)
      )
  );
end;
$$ language plpgsql security definer;

-- Accepted partners can upload videos to a user's storage folder.
-- Path convention: {lifterUserId}/{videoId}.mp4
create policy "Partners can upload videos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'session-videos'
    and is_accepted_partner(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- ============================================================
-- Realtime: publish tables needed by downstream specs
-- ============================================================

alter publication supabase_realtime add table gym_partners;
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table session_videos;
