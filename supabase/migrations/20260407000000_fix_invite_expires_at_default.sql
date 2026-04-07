-- Fix invite expiry: use server clock instead of client clock.
-- Previously expires_at was set by the inviter's device, so a phone with a
-- lagging clock produced invites that were already expired on the server.
-- Now the DB sets expires_at = now() + 5 minutes at INSERT time.

alter table gym_partner_invites
  alter column expires_at set default now() + interval '5 minutes';
