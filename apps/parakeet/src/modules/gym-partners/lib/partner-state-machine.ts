import type { PartnerStatus } from '../model/types';

type PartnerRole = 'requester' | 'responder';

interface Transition {
  to: PartnerStatus;
  allowedRoles: readonly PartnerRole[];
}

/**
 * Valid status transitions for gym partner relationships.
 *
 * - pending → accepted (responder only)
 * - pending → declined (responder only)
 * - pending → removed  (either side — cancel)
 * - accepted → removed (either side)
 */
export const VALID_TRANSITIONS: Record<string, readonly Transition[]> = {
  pending: [
    { to: 'accepted', allowedRoles: ['responder'] },
    { to: 'declined', allowedRoles: ['responder'] },
    { to: 'removed', allowedRoles: ['requester', 'responder'] },
  ],
  accepted: [
    { to: 'removed', allowedRoles: ['requester', 'responder'] },
  ],
};

export function canTransition({
  currentStatus,
  targetStatus,
  role,
}: {
  currentStatus: PartnerStatus;
  targetStatus: PartnerStatus;
  role: PartnerRole;
}) {
  const transitions = VALID_TRANSITIONS[currentStatus];
  if (!transitions) return false;

  return transitions.some(
    (t) => t.to === targetStatus && t.allowedRoles.includes(role),
  );
}
