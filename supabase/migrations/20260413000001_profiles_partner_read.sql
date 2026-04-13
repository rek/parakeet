-- Allow reading profiles of users you have a gym_partners row with (any status).
-- Existing users_own_profile policy still grants self-access; PostgreSQL OR's same-cmd
-- policies, so this is purely additive. Without it, partner display names fall back
-- to 'Partner' everywhere (claimInvite return, fetchAcceptedPartners embed,
-- fetchPendingIncomingRequests embed) because the embed RLS-filters and PostgREST
-- nulls the entire row in single-row queries.

create policy "Read partner profiles"
  on profiles for select
  using (
    exists (
      select 1 from gym_partners
      where (requester_id = auth.uid() and responder_id = profiles.id)
         or (responder_id = auth.uid() and requester_id = profiles.id)
    )
  );
