import { Lift } from '@parakeet/shared-types';

import { roundToNearest } from '../formulas/weight-rounding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeightAutoregulationContext {
  /** RPE logged for the just-completed set */
  rpeActual: number;
  /** Prescribed RPE target for this session's working sets */
  rpeTarget: number;
  /** Weight used for the completed set, in kg */
  currentWeightKg: number;
  /** Primary lift — determines increment size */
  primaryLift: Lift;
  /** How many working sets remain after the completed set */
  remainingSetCount: number;
  /** Deload week — weight is intentionally light */
  isDeload: boolean;
  /** Recovery mode (soreness >= 9/10) — don't push */
  isRecoveryMode: boolean;
  /** Already accepted a weight suggestion this session */
  hasAlreadyAdjusted: boolean;
}

export interface WeightSuggestion {
  /** Suggested weight for the next set, rounded to 2.5 kg */
  suggestedWeightKg: number;
  /** How much was added (for display) */
  deltaKg: number;
  /** Human-readable rationale */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Constants — tune these from prod data
// ---------------------------------------------------------------------------

/** Minimum RPE gap (target - actual) to trigger a suggestion */
const MIN_GAP = 1.0;

/** RPE gap threshold for a larger increment */
const LARGE_GAP = 1.5;

/** Small increment per lift category */
const SMALL_INCREMENT: Record<string, number> = {
  bench: 2.5,
  squat: 5,
  deadlift: 5,
};

/** Large increment per lift category */
const LARGE_INCREMENT: Record<string, number> = {
  bench: 5,
  squat: 10,
  deadlift: 10,
};

const DEFAULT_SMALL_INCREMENT = 2.5;
const DEFAULT_LARGE_INCREMENT = 5;

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Evaluates whether the just-completed set was easy enough to warrant a
 * weight increase for the next set. Returns a suggestion or null.
 *
 * Called after RPE is logged for a main lift set. Parallel to
 * evaluateVolumeRecovery() which adds sets; this adjusts weight.
 */
export function evaluateWeightAutoregulation(
  ctx: WeightAutoregulationContext
): WeightSuggestion | null {
  const {
    rpeActual,
    rpeTarget,
    currentWeightKg,
    primaryLift,
    remainingSetCount,
    isDeload,
    isRecoveryMode,
    hasAlreadyAdjusted,
  } = ctx;

  // Guards — suppress suggestions when inappropriate
  if (remainingSetCount <= 0) return null;
  if (isDeload) return null;
  if (isRecoveryMode) return null;
  if (hasAlreadyAdjusted) return null;

  const gap = rpeTarget - rpeActual;
  if (gap < MIN_GAP) return null;

  const isLargeGap = gap >= LARGE_GAP;
  const deltaKg = isLargeGap
    ? (LARGE_INCREMENT[primaryLift] ?? DEFAULT_LARGE_INCREMENT)
    : (SMALL_INCREMENT[primaryLift] ?? DEFAULT_SMALL_INCREMENT);

  const suggestedWeightKg = roundToNearest(currentWeightKg + deltaKg);

  return {
    suggestedWeightKg,
    deltaKg,
    rationale: `RPE ${rpeActual} vs target ${rpeTarget} — try +${deltaKg} kg`,
  };
}
