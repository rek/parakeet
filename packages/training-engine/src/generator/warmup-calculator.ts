import type { Lift } from '@parakeet/shared-types';
import {
  getPrimaryMusclesForSession,
  getSorenessModifier,
  getWorstSoreness,
  type SorenessLevel,
} from '../adjustments/soreness-adjuster';
import type { MuscleGroup } from '../types';
import { roundToNearest } from '../formulas/weight-rounding';

export type WarmupPresetName =
  | 'standard'
  | 'standard_female'
  | 'minimal'
  | 'extended'
  | 'empty_bar';

export type WarmupProtocol =
  | { type: 'preset'; name: WarmupPresetName }
  | { type: 'custom'; steps: WarmupStep[] };

export interface WarmupStep {
  pct: number; // fraction of working weight; 0 = resolves to bar weight via Math.max(barWeightKg, ...)
  reps: number;
}

export interface WarmupSet {
  setNumber: number;
  weightKg: number;
  displayWeight: string;
  reps: number;
  isWarmup: true;
}

const PRESET_STEPS: Record<WarmupPresetName, WarmupStep[]> = {
  standard: [
    { pct: 0.4, reps: 5 },
    { pct: 0.6, reps: 3 },
    { pct: 0.75, reps: 2 },
    { pct: 0.9, reps: 1 },
  ],
  standard_female: [
    { pct: 0.4, reps: 5 },
    { pct: 0.55, reps: 4 },
    { pct: 0.7, reps: 3 },
    { pct: 0.85, reps: 2 },
    { pct: 0.925, reps: 1 },
  ],
  minimal: [
    { pct: 0.5, reps: 5 },
    { pct: 0.75, reps: 2 },
  ],
  extended: [
    { pct: 0.3, reps: 10 },
    { pct: 0.5, reps: 5 },
    { pct: 0.65, reps: 3 },
    { pct: 0.8, reps: 2 },
    { pct: 0.9, reps: 1 },
    { pct: 0.95, reps: 1 },
  ],
  // pct: 0 → always resolves to bar weight via Math.max(barWeightKg, ...)
  empty_bar: [
    { pct: 0.0, reps: 10 },
    { pct: 0.5, reps: 5 },
    { pct: 0.7, reps: 3 },
    { pct: 0.85, reps: 1 },
  ],
};

export function getPresetSteps(name: WarmupPresetName): WarmupStep[] {
  return PRESET_STEPS[name];
}

export function resolveProtocol(protocol: WarmupProtocol): WarmupStep[] {
  if (protocol.type === 'custom') return protocol.steps;
  return getPresetSteps(protocol.name);
}

/**
 * Resolve the effective warmup protocol, applying the minimal override when
 * the user hasn't explicitly configured a protocol and either the session is
 * in recovery mode or the working weight is very light.
 */
export function resolveEffectiveWarmupProtocol(opts: {
  workingWeightKg: number;
  warmupConfig: WarmupProtocol;
  warmupConfigExplicit?: boolean;
  primaryLift: Lift;
  sorenessRatings: Partial<Record<MuscleGroup, SorenessLevel>>;
  biologicalSex?: 'female' | 'male';
}): WarmupProtocol {
  if (opts.warmupConfigExplicit) return opts.warmupConfig;

  const primaryMuscles = getPrimaryMusclesForSession(opts.primaryLift);
  const worstSoreness = getWorstSoreness(primaryMuscles, opts.sorenessRatings);
  const isRecoveryMode = getSorenessModifier(worstSoreness, opts.biologicalSex).recoveryMode;

  if (isRecoveryMode || opts.workingWeightKg < 40) {
    return { type: 'preset', name: 'minimal' };
  }
  return opts.warmupConfig;
}

export function generateWarmupSets(
  workingWeightKg: number,
  protocol: WarmupProtocol,
  barWeightKg = 20
): WarmupSet[] {
  const steps = resolveProtocol(protocol);
  const sets: WarmupSet[] = [];
  let prevWeight: number | null = null;

  for (const step of steps) {
    const weightKg = Math.max(
      barWeightKg,
      roundToNearest(workingWeightKg * step.pct)
    );

    // Skip duplicate consecutive weights
    if (prevWeight !== null && weightKg === prevWeight) continue;

    const displayWeight =
      weightKg === barWeightKg ? `${barWeightKg} kg (bar)` : `${weightKg} kg`;

    sets.push({
      setNumber: sets.length + 1,
      weightKg,
      displayWeight,
      reps: step.reps,
      isWarmup: true,
    });

    prevWeight = weightKg;
  }

  return sets;
}
