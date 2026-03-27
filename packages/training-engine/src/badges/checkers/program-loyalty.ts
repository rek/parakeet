import type { BadgeId } from '../badge-types';

/** Pre-fetched data for program loyalty badge checks. */
export interface ProgramLoyaltyData {
  /** Number of consecutive cycles using the same formula config. */
  consecutiveSameFormulaCycles: number;
  /** Number of formula changes within the current cycle. */
  formulaChangesThisCycle: number;
  /** Number of consecutive cycles without any deload week. */
  consecutiveCyclesWithoutDeload: number;
}

/** Check program & cycle loyalty badges. */
export function checkProgramLoyaltyBadges(data: ProgramLoyaltyData): BadgeId[] {
  const earned: BadgeId[] = [];

  // #33 Old Faithful — same formula for 3+ consecutive cycles
  if (data.consecutiveSameFormulaCycles >= 3) earned.push('old_faithful');

  // #34 Shiny Object Syndrome — 3+ formula changes in one cycle
  if (data.formulaChangesThisCycle >= 3) earned.push('shiny_object_syndrome');

  // #35 Deload Denier — 3 consecutive cycles without deload
  if (data.consecutiveCyclesWithoutDeload >= 3) earned.push('deload_denier');

  return earned;
}
