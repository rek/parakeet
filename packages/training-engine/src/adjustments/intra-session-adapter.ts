import { Lift, PlannedSet } from '@parakeet/shared-types';

import { roundToNearest } from '../formulas/weight-rounding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompletedSetResult {
  planned_reps: number;
  actual_reps: number;
  weight_kg: number;
  rpe_actual?: number;
}

export interface IntraSessionContext {
  completedSets: CompletedSetResult[];
  remainingSets: PlannedSet[];
  consecutiveFailures: number;
  primaryLift: Lift;
  oneRmKg: number;
  biologicalSex?: 'male' | 'female';
}

export type AdaptationType =
  | 'none'
  | 'extended_rest'
  | 'weight_reduced'
  | 'sets_capped';

export interface AdaptedPlan {
  sets: PlannedSet[];
  restBonusSeconds: number;
  adaptationType: AdaptationType;
  rationale: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rounds a weight to the nearest 2.5 kg increment. */
export function roundToNearest2_5(kg: number): number {
  return roundToNearest(kg, 2.5);
}

/** Returns true when the lifter completed fewer reps than planned. */
export function detectSetFailure(
  planned_reps: number,
  actual_reps: number
): boolean {
  return actual_reps < planned_reps;
}

/**
 * Applies a percentage reduction to a set's weight, clamping to a floor of
 * 40% of the session 1RM, and rounds to the nearest 2.5 kg.
 */
function reduceWeight(
  set: PlannedSet,
  reductionPct: number,
  oneRmKg: number
): PlannedSet {
  const floor = roundToNearest2_5(oneRmKg * 0.4);
  const reduced = roundToNearest2_5(set.weight_kg * (1 - reductionPct));
  return { ...set, weight_kg: Math.max(reduced, floor) };
}

// ---------------------------------------------------------------------------
// Auxiliary adaptation
// ---------------------------------------------------------------------------

export interface AuxAdaptedPlan {
  exercise: string;
  sets: PlannedSet[];
  adaptationType: 'none' | 'weight_reduced';
  rationale: string;
}

/**
 * Adapts remaining auxiliary sets after a failure. Simpler than main lift
 * adaptation: immediate 10% weight reduction (no extended-rest tier, no 1RM
 * floor — aux exercises don't have a tracked 1RM). Floor is 50% of the failed
 * set weight to prevent absurdly light prescriptions.
 */
export function adaptAuxRemainingPlan(ctx: {
  exercise: string;
  failedWeightKg: number;
  remainingSets: PlannedSet[];
}): AuxAdaptedPlan {
  if (ctx.remainingSets.length === 0) {
    return {
      exercise: ctx.exercise,
      sets: [],
      adaptationType: 'none',
      rationale: '',
    };
  }

  const floor = roundToNearest2_5(ctx.failedWeightKg * 0.5);
  return {
    exercise: ctx.exercise,
    sets: ctx.remainingSets.map((s) => {
      const reduced = roundToNearest2_5(s.weight_kg * 0.9);
      return { ...s, weight_kg: Math.max(reduced, floor) };
    }),
    adaptationType: 'weight_reduced',
    rationale: 'Weight reduced 10% — adapting after failed set',
  };
}

// ---------------------------------------------------------------------------
// Main lift adaptation
// ---------------------------------------------------------------------------

/**
 * Adapts the remaining planned sets based on how many consecutive set failures
 * have occurred so far in the session.
 *
 * - 0 failures → no change
 * - 1 failure  → extended rest bonus, sets unchanged
 * - 2 failures → 5% weight reduction on remaining sets
 * - 3+ failures → 10% weight reduction, sets flagged as optional via rationale
 *
 * Weight is always clamped to a floor of 40% of oneRmKg and rounded to the
 * nearest 2.5 kg.
 */
export function adaptRemainingPlan(ctx: IntraSessionContext): AdaptedPlan {
  const { consecutiveFailures, remainingSets, oneRmKg } = ctx;

  if (consecutiveFailures === 0 || remainingSets.length === 0) {
    return {
      sets: remainingSets,
      restBonusSeconds: 0,
      adaptationType: 'none',
      rationale: '',
    };
  }

  if (consecutiveFailures === 1) {
    return {
      sets: remainingSets,
      restBonusSeconds: 60,
      adaptationType: 'extended_rest',
      rationale:
        'Extra rest added — your body may need more recovery between sets',
    };
  }

  if (consecutiveFailures === 2) {
    return {
      sets: remainingSets.map((s) => reduceWeight(s, 0.05, oneRmKg)),
      restBonusSeconds: 0,
      adaptationType: 'weight_reduced',
      rationale:
        "Weight reduced 5% for remaining sets — adapting to today's capacity",
    };
  }

  // consecutiveFailures >= 3
  return {
    sets: remainingSets.map((s) => reduceWeight(s, 0.1, oneRmKg)),
    restBonusSeconds: 0,
    adaptationType: 'sets_capped',
    rationale:
      'Remaining sets are optional — consider moving to auxiliary work',
  };
}
