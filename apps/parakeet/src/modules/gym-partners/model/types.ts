export const PARTNER_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'removed',
] as const;

export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export interface GymPartner {
  id: string;
  partnerId: string;
  partnerName: string;
  status: PartnerStatus;
  createdAt: string;
}

export interface PartnerInvite {
  id: string;
  token: string;
  expiresAt: string;
}

export interface PartnerActiveSession {
  id: string;
  status: string;
  primaryLift: string | null;
  plannedSets: readonly unknown[];
}

/** App-level cap on accepted partnerships per user */
export const MAX_PARTNERS = 5;
