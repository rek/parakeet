import {
  fetchAcceptedPartnerCount,
  fetchCurrentUserDisplayName,
  claimInvite as repoClaimInvite,
  createInvite as repoCreateInvite,
  updatePartnerStatus,
} from '../data/partner.repository';
import { MAX_PARTNERS } from '../model/types';

async function guardDisplayName() {
  const name = await fetchCurrentUserDisplayName();
  if (!name) {
    throw new Error(
      'Set a display name in your profile before pairing with a partner'
    );
  }
}

async function guardPartnerCap() {
  const count = await fetchAcceptedPartnerCount();
  if (count >= MAX_PARTNERS) {
    throw new Error(`You already have the maximum of ${MAX_PARTNERS} partners`);
  }
}

export async function createInvite() {
  await guardDisplayName();
  await guardPartnerCap();
  return repoCreateInvite();
}

export async function claimInvite({ token }: { token: string }) {
  await guardDisplayName();
  await guardPartnerCap();
  return repoClaimInvite({ token });
}

export async function acceptPartner({
  partnershipId,
}: {
  partnershipId: string;
}) {
  return updatePartnerStatus({ id: partnershipId, status: 'accepted' });
}

export async function declinePartner({
  partnershipId,
}: {
  partnershipId: string;
}) {
  return updatePartnerStatus({ id: partnershipId, status: 'declined' });
}

export async function removePartner({
  partnershipId,
}: {
  partnershipId: string;
}) {
  return updatePartnerStatus({ id: partnershipId, status: 'removed' });
}
