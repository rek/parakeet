import type { BadgeCheckContext, BadgeId } from '../badge-types';

/** Check rest timer & pacing badges. */
export function checkRestPacingBadges(ctx: BadgeCheckContext): BadgeId[] {
  const earned: BadgeId[] = [];

  // #28 Zen Master — 5 consecutive sessions with full rest on every set (no current sets needed)
  if (ctx.consecutiveFullRestSessions >= 5) earned.push('zen_master');

  const setsWithRest = ctx.actualSets.filter(
    (s) => s.is_completed && s.actual_rest_seconds != null
  );
  if (setsWithRest.length === 0) return earned;

  // #27 Impatient — 10+ sets started before rest timer expired
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

  return earned;
}
