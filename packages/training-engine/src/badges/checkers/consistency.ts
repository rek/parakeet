import type { BadgeId } from '../badge-types';

/**
 * Consistency badges that need aggregate/historical queries.
 * These accept pre-fetched data rather than BadgeCheckContext
 * since they need different data shapes.
 */

export interface ConsistencyData {
  /** Number of completed sessions before 6:00 AM. */
  sessionsBeforeSixAm: number;
  /** Number of completed sessions after 9:00 PM. */
  sessionsAfterNinePm: number;
  /** Number of distinct Sundays with a completed session. */
  distinctSundaySessions: number;
  /** Current streak in weeks (from existing streak computation). */
  streakWeeks: number;
  /** Number of consecutive planned squat/deadlift sessions completed without miss. */
  consecutiveLegDaySessions: number;
  /** Whether the current week is "perfect" (all planned sessions done, no extras). */
  isPerfectWeek: boolean;
  /** Consecutive completed sessions where every planned set was met. */
  consecutivePerfectSessions: number;
}

export function checkConsistencyBadges(data: ConsistencyData): BadgeId[] {
  const earned: BadgeId[] = [];

  // #1 Dawn Patrol
  if (data.sessionsBeforeSixAm >= 5) earned.push('dawn_patrol');

  // #2 Night Owl
  if (data.sessionsAfterNinePm >= 5) earned.push('night_owl');

  // #3 Iron Monk — 30 consecutive sessions with perfect set completion
  if (data.consecutivePerfectSessions >= 30) earned.push('iron_monk');

  // #4 Sunday Scaries Cure
  if (data.distinctSundaySessions >= 10) earned.push('sunday_scaries_cure');

  // #5 365
  if (data.streakWeeks >= 52) earned.push('year_365');

  // #6 Perfect Week
  if (data.isPerfectWeek) earned.push('perfect_week');

  // #7 Leg Day Loyalist
  if (data.consecutiveLegDaySessions >= 20) earned.push('leg_day_loyalist');

  return earned;
}
