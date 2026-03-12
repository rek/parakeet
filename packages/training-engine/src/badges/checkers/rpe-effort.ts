import type { BadgeCheckContext, BadgeId } from '../badge-types';

/** Check RPE & effort pattern badges. */
export function checkRpeEffortBadges(ctx: BadgeCheckContext): BadgeId[] {
  const earned: BadgeId[] = [];
  const completedWithRpe = ctx.actualSets.filter(
    (s) => s.is_completed && s.rpe_actual != null
  );

  if (completedWithRpe.length === 0) return earned;

  // #30 RPE Whisperer — every set within 0.5 of prescribed RPE (min 8 sets)
  if (completedWithRpe.length >= 8) {
    const allWithinTarget = completedWithRpe.every((s, i) => {
      const planned = ctx.plannedSets[i];
      if (!planned?.rpe_target || s.rpe_actual == null) return false;
      return Math.abs(s.rpe_actual - planned.rpe_target) <= 0.5;
    });
    if (allWithinTarget) earned.push('rpe_whisperer');
  }

  // #31 Sandbag Detected — RPE 6 or below on every set
  const allLowRpe = completedWithRpe.every(
    (s) => s.rpe_actual != null && s.rpe_actual <= 6
  );
  if (allLowRpe) earned.push('sandbag_detected');

  // #32 Send It — RPE 10 on any set that wasn't the last
  const lastSetIndex = ctx.actualSets.length - 1;
  for (let i = 0; i < lastSetIndex; i++) {
    const s = ctx.actualSets[i];
    if (s.is_completed && s.rpe_actual === 10) {
      earned.push('send_it');
      break;
    }
  }

  return earned;
}
