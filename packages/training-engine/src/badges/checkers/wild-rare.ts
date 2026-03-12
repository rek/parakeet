import type { BadgeCheckContext, BadgeId } from '../badge-types';

/** Check wild & rare badges. */
export function checkWildRareBadges(ctx: BadgeCheckContext): BadgeId[] {
  const earned: BadgeId[] = [];

  // #43 Ghost Protocol — session under 30 minutes
  if (ctx.durationSeconds != null && ctx.durationSeconds > 0) {
    if (ctx.durationSeconds < 30 * 60) earned.push('ghost_protocol');
  }

  // #44 Marathon Lifter — session over 2 hours
  if (ctx.durationSeconds != null && ctx.durationSeconds > 2 * 60 * 60) {
    earned.push('marathon_lifter');
  }

  // #45 The Streak Breaker — tracked via separate logic (needs streak history)
  // Deferred to Slice 7

  return earned;
}
