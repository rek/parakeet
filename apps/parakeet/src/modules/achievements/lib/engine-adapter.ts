/**
 * Re-exports of @parakeet/training-engine symbols used within the achievements
 * module. Internal files import from this adapter so the dependency on the
 * engine package stays contained to a single boundary.
 */
export type { BadgeId, EarnedBadge } from '@parakeet/training-engine';
export type { PR, StreakResult, WeekStatus } from '@parakeet/training-engine';
export {
  BADGE_CATALOG,
  computeStreak,
  computeWilks2020,
  detectSessionPRs,
} from '@parakeet/training-engine';
