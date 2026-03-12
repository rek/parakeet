import type { BadgeCheckContext, BadgeId } from '../badge-types';

/** Check lift identity & favoritism badges. */
export function checkLiftIdentityBadges(ctx: BadgeCheckContext): BadgeId[] {
  const earned: BadgeId[] = [];
  const { allLiftE1RMs } = ctx;

  const squat = allLiftE1RMs['squat'] ?? 0;
  const bench = allLiftE1RMs['bench'] ?? 0;
  const deadlift = allLiftE1RMs['deadlift'] ?? 0;

  // Need all three lifts to have data
  if (squat === 0 || bench === 0 || deadlift === 0) return earned;

  // #24 Bench Bro — bench > squat
  if (bench > squat) earned.push('bench_bro');

  // #25 The Specialist — one lift 40%+ higher than weakest
  const max = Math.max(squat, bench, deadlift);
  const min = Math.min(squat, bench, deadlift);
  if (min > 0 && (max - min) / min >= 0.4) earned.push('the_specialist');

  // #26 Equal Opportunity Lifter — all within 15%
  const lifts = [squat, bench, deadlift];
  const liftMax = Math.max(...lifts);
  const liftMin = Math.min(...lifts);
  if (liftMin > 0 && (liftMax - liftMin) / liftMin <= 0.15) {
    earned.push('equal_opportunity_lifter');
  }

  return earned;
}
