// --- Types ---
export type { GymPartner, PartnerInvite, PartnerStatus } from './model/types';
export { PARTNER_STATUSES, MAX_PARTNERS } from './model/types';

// --- State machine ---
export { canTransition, VALID_TRANSITIONS } from './lib/partner-state-machine';

// --- Query factory ---
export { partnerQueries } from './data/partner.queries';
