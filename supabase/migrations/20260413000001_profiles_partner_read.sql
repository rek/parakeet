-- Allow reading profiles of partners. Existing users_own_profile policy still grants
-- self-access; PostgreSQL OR's same-cmd policies, so this is purely additive.
--
-- Asymmetric on purpose to preserve consent semantics:
--   - Responder side: any status — so a user receiving a pending request can see
--     the requester's name to decide whether to accept
--   - Requester side: status='accepted' only — so a user who sends an unsolicited
--     request CANNOT learn the target's display_name until the target accepts
--
-- Without this asymmetry, anyone with a target's UUID could insert a pending
-- gym_partners row and immediately read the target's display_name, leaking it
-- pre-consent.

create policy "Read partner profiles"
  on profiles for select
  using (
    exists (
      select 1 from gym_partners
      where (responder_id = auth.uid() and requester_id = profiles.id)
         or (requester_id = auth.uid() and responder_id = profiles.id and status = 'accepted')
    )
  );
