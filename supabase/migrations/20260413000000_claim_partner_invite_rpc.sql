-- Atomic claim flow as SECURITY DEFINER.
--
-- Why an RPC: PostgREST .update().select(...).maybeSingle() against this table
-- returned null `data` even when the row existed and policies should pass. Most
-- likely cause: UPDATE...RETURNING re-evaluates the SELECT RLS policy, and the
-- check sometimes runs against the pre-update row (claimed_by IS NULL) instead
-- of the new row (claimed_by = scanner). The "Inviter and claimer can read invites"
-- policy then filters the row out and PostgREST returns no data. Switching to a
-- SECURITY DEFINER function bypasses RLS for the function body while auth.uid()
-- still resolves to the real caller, so requester_id can't be spoofed.
--
-- Note on rollback: every `raise` inside this function aborts the transaction,
-- so explicit `update ... claimed_by = null` statements before raises are NOT
-- needed — the abort rolls the claim UPDATE back automatically. The `begin
-- exception` block only exists to MAP postgres errors (unique_violation) into
-- application-specific codes for the client.

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

  if v_inviter_id = v_user_id then
    raise exception 'Cannot pair with yourself' using errcode = 'P0002';
  end if;

  begin
    insert into gym_partners (requester_id, responder_id)
    values (v_user_id, v_inviter_id);
  exception
    when unique_violation then
      raise exception 'Already partnered with this user' using errcode = 'P0003';
  end;

  return query select v_inviter_id;
end;
$$;

revoke all on function claim_partner_invite(text) from public, anon;
grant execute on function claim_partner_invite(text) to authenticated;
