-- Atomic claim flow as SECURITY DEFINER. Bypasses PostgREST/RLS quirks
-- with .update().select() chains where RETURNING after RLS UPDATE
-- intermittently produces empty results.

create or replace function claim_partner_invite(p_token text)
returns table(inviter_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_inviter_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Atomic claim: SET claimed_by only if currently NULL
  update gym_partner_invites
  set claimed_by = v_user_id
  where token = p_token and claimed_by is null
  returning gym_partner_invites.inviter_id into v_inviter_id;

  if v_inviter_id is null then
    raise exception 'Invite already claimed or invalid' using errcode = 'P0001';
  end if;

  -- Self-claim guard
  if v_inviter_id = v_user_id then
    update gym_partner_invites set claimed_by = null where token = p_token;
    raise exception 'Cannot pair with yourself' using errcode = 'P0002';
  end if;

  -- Create the partnership. Roll back claim on any failure so token stays usable.
  begin
    insert into gym_partners (requester_id, responder_id)
    values (v_user_id, v_inviter_id);
  exception
    when unique_violation then
      update gym_partner_invites set claimed_by = null where token = p_token;
      raise exception 'Already partnered with this user' using errcode = 'P0003';
    when others then
      update gym_partner_invites set claimed_by = null where token = p_token;
      raise;
  end;

  return query select v_inviter_id;
end;
$$;

revoke all on function claim_partner_invite(text) from public, anon;
grant execute on function claim_partner_invite(text) to authenticated;
