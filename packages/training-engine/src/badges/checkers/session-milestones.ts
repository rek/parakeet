import type { BadgeCheckContext, BadgeId } from '../badge-types';

/** Check session milestone badges. */
export function checkSessionMilestoneBadges(ctx: BadgeCheckContext): BadgeId[] {
  const earned: BadgeId[] = [];

  // #39 First Blood — very first session
  if (ctx.totalCompletedSessions === 1) earned.push('first_blood');

  // #40 Parakeet OG — first completed cycle
  if (ctx.completedCycles >= 1) earned.push('parakeet_og');

  // #41 Century Club — 100 sessions
  if (ctx.totalCompletedSessions >= 100) earned.push('century_club');

  // #42 500 Club — 500 sessions
  if (ctx.totalCompletedSessions >= 500) earned.push('five_hundred_club');

  return earned;
}
