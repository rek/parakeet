// --- Types ---
export type { GymPartner, PartnerInvite, PartnerStatus } from './model/types';
export { PARTNER_STATUSES, MAX_PARTNERS } from './model/types';

// --- State machine ---
export type { PartnerRole } from './lib/partner-state-machine';
export { canTransition, VALID_TRANSITIONS } from './lib/partner-state-machine';

// --- Query factory ---
export { partnerQueries } from './data/partner.queries';

// --- Hooks ---
export {
  usePartners,
  useCreateInvite,
  useClaimInvite,
  useAcceptPartner,
  useDeclinePartner,
  useRemovePartner,
} from './hooks/usePartners';
export { usePartnerSessions } from './hooks/usePartnerSessions';
export { usePartnerFilming } from './hooks/usePartnerFilming';
export { usePartnerVideoBadge } from './hooks/usePartnerVideoBadge';

// --- UI ---
export { PartnerManagementScreen } from './ui/PartnerManagementScreen';
export { PartnerSection } from './ui/PartnerSection';
export { PartnerFilmingSheet } from './ui/PartnerFilmingSheet';
