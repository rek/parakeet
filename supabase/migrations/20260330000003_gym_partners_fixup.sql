-- Fixup: apply changes that were added to 20260330000000_create_gym_partners.sql
-- after it was already deployed. Fresh installs already have these via the base
-- migration; this brings the hosted DB up to date.

-- 1. Token DEFAULT — Hermes lacks crypto.randomUUID(), so Postgres generates it
alter table gym_partner_invites
  alter column token set default gen_random_uuid()::text;

-- 2. Auto-update updated_at trigger (repository no longer sets it manually)
create or replace function update_gym_partners_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger if not exists trg_gym_partners_updated_at
  before update on gym_partners
  for each row execute function update_gym_partners_updated_at();

-- 3. Unclaim policy — allows rollback on failed partnership insert or self-claim
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'gym_partner_invites'
      and policyname = 'Claimer can unclaim own invite'
  ) then
    create policy "Claimer can unclaim own invite"
      on gym_partner_invites for update to authenticated
      using (claimed_by = auth.uid())
      with check (claimed_by is null);
  end if;
end $$;

-- 4. Storage RLS — partner upload policy for session-videos bucket
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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'objects'
      and policyname = 'Partners can upload videos'
  ) then
    create policy "Partners can upload videos"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'session-videos'
        and is_accepted_partner(auth.uid(), (storage.foldername(name))[1]::uuid)
      );
  end if;
end $$;
