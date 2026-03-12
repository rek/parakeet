import type { BadgeCheckContext, BadgeId } from '../badge-types';

/** Check rest timer & pacing badges. */
export function checkRestPacingBadges(ctx: BadgeCheckContext): BadgeId[] {
  const earned: BadgeId[] = [];
  const setsWithRest = ctx.actualSets.filter(
    (s) => s.is_completed && s.actual_rest_seconds != null
  );

  if (setsWithRest.length === 0) return earned;

  // #27 Impatient — 10+ sets started before rest timer expired
  // We can only detect this if actual_rest_seconds is tracked.
  // A short rest (e.g., < configured rest) implies impatience.
  // For now, count sets with rest < 60s as "impatient" sets.
  // TODO: compare against configured rest time when available in context
  const impatientSets = setsWithRest.filter(
    (s) => s.actual_rest_seconds! < 60
  );
  if (impatientSets.length >= 10) earned.push('impatient');

  // #29 Social Hour — average rest > 5 minutes
  const totalRest = setsWithRest.reduce(
    (sum, s) => sum + (s.actual_rest_seconds ?? 0),
    0
  );
  const avgRest = totalRest / setsWithRest.length;
  if (avgRest > 300) earned.push('social_hour');

  // #28 Zen Master — needs 5 consecutive sessions, deferred to Slice 6

  return earned;
}
