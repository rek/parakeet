import type { DbRow } from '@platform/supabase';
import { typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';

import type { GymPartner, PartnerInvite, PartnerStatus } from '../model/types';

type GymPartnerRow = DbRow<'gym_partners'>;

function toGymPartner({
  row,
  currentUserId,
  partnerDisplayName,
}: {
  row: GymPartnerRow;
  currentUserId: string;
  partnerDisplayName: string | null;
}): GymPartner {
  const isRequester = row.requester_id === currentUserId;
  return {
    id: row.id,
    partnerId: isRequester ? row.responder_id : row.requester_id,
    partnerName: partnerDisplayName ?? 'Partner',
    status: row.status as PartnerStatus,
    createdAt: row.created_at,
  };
}

export async function fetchAcceptedPartners() {
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await typedSupabase
    .from('gym_partners')
    .select(
      '*, requester:profiles!gym_partners_requester_id_fkey(display_name), responder:profiles!gym_partners_responder_id_fkey(display_name)',
    )
    .or(`requester_id.eq.${user.id},responder_id.eq.${user.id}`)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false });

  if (error) {
    captureException(error);
    throw error;
  }

  return (data ?? []).map((row) => {
    const isRequester = row.requester_id === user.id;
    const partnerProfile = isRequester ? row.responder : row.requester;
    const displayName = partnerProfile?.display_name ?? null;
    return toGymPartner({ row, currentUserId: user.id, partnerDisplayName: displayName });
  });
}

export async function fetchPendingIncomingRequests() {
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await typedSupabase
    .from('gym_partners')
    .select(
      '*, requester:profiles!gym_partners_requester_id_fkey(display_name)',
    )
    .eq('responder_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    captureException(error);
    throw error;
  }

  return (data ?? []).map((row) =>
    toGymPartner({
      row,
      currentUserId: user.id,
      partnerDisplayName: row.requester?.display_name ?? null,
    }),
  );
}

export async function updatePartnerStatus({
  id,
  status,
}: {
  id: string;
  status: PartnerStatus;
}) {
  const { error } = await typedSupabase
    .from('gym_partners')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    captureException(error);
    throw error;
  }
}

export async function createInvite() {
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { data, error } = await typedSupabase
    .from('gym_partner_invites')
    .insert({
      inviter_id: user.id,
      token,
      expires_at: expiresAt,
    })
    .select('id, token, expires_at')
    .single();

  if (error) {
    captureException(error);
    throw error;
  }

  return {
    id: data.id,
    token: data.token,
    expiresAt: data.expires_at,
  } satisfies PartnerInvite;
}

export async function claimInvite({ token }: { token: string }) {
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Atomic claim: only succeeds if unclaimed and unexpired
  const { data, error } = await typedSupabase
    .from('gym_partner_invites')
    .update({ claimed_by: user.id })
    .eq('token', token)
    .is('claimed_by', null)
    .gt('expires_at', new Date().toISOString())
    .select('inviter_id, inviter:profiles!gym_partner_invites_inviter_id_fkey(display_name)')
    .maybeSingle();

  if (error) {
    captureException(error);
    throw error;
  }

  if (!data) {
    throw new Error('Invite expired or already claimed');
  }

  // Create the partnership
  const { error: partnerError } = await typedSupabase
    .from('gym_partners')
    .insert({
      requester_id: data.inviter_id,
      responder_id: user.id,
    });

  if (partnerError) {
    captureException(partnerError);
    throw partnerError;
  }

  return {
    inviterId: data.inviter_id,
    inviterName: data.inviter?.display_name ?? null,
  };
}
