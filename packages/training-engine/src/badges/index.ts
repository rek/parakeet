export { BADGE_CATALOG, ALL_BADGE_IDS } from './badge-catalog';
export type {
  BadgeId,
  BadgeCategory,
  BadgeDef,
  EarnedBadge,
  BadgeActualSet,
  BadgePlannedSet,
  BadgeCheckContext,
} from './badge-types';

// Checkers
export { checkPerformanceBadges } from './checkers/performance';
export { checkSituationalBadges } from './checkers/situational';
export { checkRpeEffortBadges } from './checkers/rpe-effort';
export { checkVolumeRepBadges } from './checkers/volume-rep';
export { checkSessionMilestoneBadges } from './checkers/session-milestones';
export { checkWildRareBadges } from './checkers/wild-rare';
export { checkLiftIdentityBadges } from './checkers/lift-identity';
export { checkRestPacingBadges } from './checkers/rest-pacing';
export {
  checkConsistencyBadges,
  type ConsistencyData,
} from './checkers/consistency';
export {
  checkProgramLoyaltyBadges,
  type ProgramLoyaltyData,
} from './checkers/program-loyalty';
export { checkCouplesBadges } from './checkers/couples';
