import type { BadgeCheckContext, BadgeId } from '../badge-types';

/** Check funny & situational badges. */
export function checkSituationalBadges(ctx: BadgeCheckContext): BadgeId[] {
  const earned: BadgeId[] = [];

  // #15 Comeback Kid — PR within 2 sessions of returning from a 7+ day disruption
  if (
    ctx.earnedPRs.length > 0 &&
    ctx.lastDisruptionDurationDays != null &&
    ctx.lastDisruptionDurationDays >= 7 &&
    ctx.daysSinceLastDisruption != null &&
    ctx.daysSinceLastDisruption <= 14 // rough proxy for "within 2 sessions"
  ) {
    earned.push('comeback_kid');
  }

  // #16 Didn't Want To Be Here — poor sleep + low energy + 100% completion
  if (ctx.sleepQuality === 1 && ctx.energyLevel === 1) {
    const completedCount = ctx.actualSets.filter((s) => s.is_completed).length;
    const totalCount = ctx.plannedSets.length;
    if (totalCount > 0 && completedCount >= totalCount) {
      earned.push('didnt_want_to_be_here');
    }
  }

  // #18 One More Rep — actual reps > planned reps on 3+ sets
  let extraRepSets = 0;
  for (
    let i = 0;
    i < ctx.actualSets.length && i < ctx.plannedSets.length;
    i++
  ) {
    if (
      ctx.actualSets[i].is_completed &&
      ctx.actualSets[i].reps_completed > ctx.plannedSets[i].reps
    ) {
      extraRepSets++;
    }
  }
  if (extraRepSets >= 3) earned.push('one_more_rep');

  // #19 Plate Math PhD — 5+ distinct weight values
  const distinctWeights = new Set(
    ctx.actualSets
      .filter((s) => s.is_completed && s.weight_grams > 0)
      .map((s) => s.weight_grams)
  );
  if (distinctWeights.size >= 5) earned.push('plate_math_phd');

  // #20 Sandbagger — Rep-at-Weight PR on the final set
  if (ctx.actualSets.length > 0) {
    const lastSet = ctx.actualSets[ctx.actualSets.length - 1];
    if (lastSet.is_completed) {
      const hasRepPrOnLastSet = ctx.earnedPRs.some(
        (pr) =>
          pr.type === 'rep_at_weight' &&
          pr.weightKg != null &&
          Math.abs(pr.weightKg * 1000 - lastSet.weight_grams) < 1
      );
      if (hasRepPrOnLastSet) earned.push('sandbagger');
    }
  }

  // #21 Bad Day Survivor — 50%+ completion with active Major disruption
  if (ctx.hasActiveMajorDisruption) {
    const completedCount = ctx.actualSets.filter((s) => s.is_completed).length;
    const totalCount = ctx.plannedSets.length;
    if (totalCount > 0 && completedCount / totalCount >= 0.5) {
      earned.push('bad_day_survivor');
    }
  }

  // #17 Volume Goblin — 5+ non-1RM PRs with 0 1RM PRs
  if (ctx.volumePrCount >= 5 && ctx.oneRmPrCount === 0) {
    earned.push('volume_goblin');
  }

  // #22 The Grinder — RPE 9.5+ on 3+ sets
  const highRpeSets = ctx.actualSets.filter(
    (s) => s.is_completed && s.rpe_actual != null && s.rpe_actual >= 9.5
  );
  if (highRpeSets.length >= 3) earned.push('the_grinder');

  // #23 Tactical Retreat — PR right after a deload
  if (ctx.previousSessionWasDeload && ctx.earnedPRs.length > 0) {
    earned.push('tactical_retreat');
  }

  return earned;
}
