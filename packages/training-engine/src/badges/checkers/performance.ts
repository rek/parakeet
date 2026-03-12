import type { BadgeCheckContext, BadgeId } from '../badge-types';

/** Check performance & milestone badges derivable from the current session. */
export function checkPerformanceBadges(ctx: BadgeCheckContext): BadgeId[] {
  const earned: BadgeId[] = [];

  // #10 The Tonne — session volume > 10,000 kg
  const totalVolumeKg = ctx.actualSets.reduce(
    (sum, s) =>
      s.is_completed ? sum + (s.weight_grams / 1000) * s.reps_completed : sum,
    0
  );
  if (totalVolumeKg >= 10_000) earned.push('the_tonne');

  // #14 The Centurion — 100+ reps of a single primary lift
  if (ctx.primaryLift) {
    const primaryReps = ctx.actualSets.reduce(
      (sum, s) => (s.is_completed ? sum + s.reps_completed : sum),
      0
    );
    if (primaryReps >= 100) earned.push('the_centurion');
  }

  // #8 Gravity, Meet Your Match — any lift e1RM > bodyweight
  if (ctx.bodyweightKg && ctx.bodyweightKg > 0) {
    const anyExceedsBw = Object.values(ctx.allLiftE1RMs).some(
      (e1rm) => e1rm > ctx.bodyweightKg!
    );
    if (anyExceedsBw) earned.push('gravity_meet_your_match');

    // #9 Sir Isaac's Worst Nightmare — any lift e1RM > 2x bodyweight
    const anyExceeds2xBw = Object.values(ctx.allLiftE1RMs).some(
      (e1rm) => e1rm > ctx.bodyweightKg! * 2
    );
    if (anyExceeds2xBw) earned.push('sir_isaacs_worst_nightmare');
  }

  // #11 Round Number Enjoyer — PR on a round number
  const roundNumbers = new Set([
    60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300,
  ]);
  for (const pr of ctx.earnedPRs) {
    if (pr.type === 'estimated_1rm' && roundNumbers.has(Math.round(pr.value))) {
      earned.push('round_number_enjoyer');
      break;
    }
  }

  // #12 Triple Threat — all 3 PR types in one session
  const prTypes = new Set(ctx.earnedPRs.map((pr) => pr.type));
  if (
    prTypes.has('estimated_1rm') &&
    prTypes.has('volume') &&
    prTypes.has('rep_at_weight')
  ) {
    earned.push('triple_threat');
  }

  // #13 Technically a PR — e1RM PR by smallest increment (0.5–1.25 kg)
  for (const pr of ctx.earnedPRs) {
    if (pr.type === 'estimated_1rm') {
      const prevBest = ctx.previousE1Rm[pr.lift] ?? 0;
      const diff = pr.value - prevBest;
      if (prevBest > 0 && diff > 0 && diff <= 1.25) {
        earned.push('technically_a_pr');
        break;
      }
    }
  }

  return earned;
}
