-- Invites no longer expire — they stay claimable until used.
-- Removes expires_at column, cleans up the expiry-checking RLS policy and trigger.

drop trigger if exists trg_cleanup_expired_invites on gym_partner_invites;
drop function if exists cleanup_expired_invites();

alter table gym_partner_invites drop column expires_at;

drop policy "Authenticated users can claim unclaimed invites" on gym_partner_invites;

create policy "Authenticated users can claim unclaimed invites"
  on gym_partner_invites for update to authenticated
  using (claimed_by is null)
  with check (claimed_by = auth.uid());
