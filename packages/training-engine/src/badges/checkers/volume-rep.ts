import type { BadgeCheckContext, BadgeId } from '../badge-types';

/** Check volume & rep range badges. */
export function checkVolumeRepBadges(ctx: BadgeCheckContext): BadgeId[] {
  const earned: BadgeId[] = [];

  // #38 Jack of All Lifts — 10+ unique aux exercises in a cycle (no sets needed)
  if (ctx.uniqueAuxExercisesInCycle >= 10) earned.push('jack_of_all_lifts');

  const completed = ctx.actualSets.filter((s) => s.is_completed);
  if (completed.length === 0) return earned;

  // #36 Rep Machine — 50+ reps of a single primary lift
  if (ctx.primaryLift) {
    const totalReps = completed.reduce((sum, s) => sum + s.reps_completed, 0);
    if (totalReps >= 50) earned.push('rep_machine');
  }

  // #37 Singles Club — every primary lift set is a single (1 rep)
  if (ctx.primaryLift && completed.length > 0) {
    const allSingles = completed.every((s) => s.reps_completed === 1);
    if (allSingles) earned.push('singles_club');
  }

  return earned;
}
