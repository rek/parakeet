import { Lift, PlannedSet } from '@parakeet/shared-types';

import { roundToNearest } from '../formulas/weight-rounding';
import { MuscleGroup } from '../types';

/** 1-10 scale. Legacy 1-5 values are accepted and mapped to the same thresholds. */
export type SorenessLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface SorenessModifier {
  setReduction: number;
  intensityMultiplier: number;
  recoveryMode: boolean;
  warning: string | null;
}

// Thresholds on the 1-10 scale.
// Legacy 1-5 inputs are doubled before lookup, so old behavior is preserved:
//   old 1 → 2 (fresh), old 2 → 4 (mild), old 3 → 6 (moderate),
//   old 4 → 8 (high), old 5 → 10 (severe)
const FRESH: SorenessModifier = {
  setReduction: 0,
  intensityMultiplier: 1.0,
  recoveryMode: false,
  warning: null,
};

const MODERATE_MALE: SorenessModifier = {
  setReduction: 1,
  intensityMultiplier: 1.0,
  recoveryMode: false,
  warning: 'Moderate soreness — reduced 1 set',
};

const HIGH_MALE: SorenessModifier = {
  setReduction: 2,
  intensityMultiplier: 0.95,
  recoveryMode: false,
  warning: 'High soreness — reduced volume and intensity 5%',
};

const HIGH_FEMALE: SorenessModifier = {
  setReduction: 1,
  intensityMultiplier: 0.97,
  recoveryMode: false,
  warning: 'High soreness — reduced 1 set and intensity 3%',
};

const SEVERE: SorenessModifier = {
  setReduction: 0,
  intensityMultiplier: 0.0,
  recoveryMode: true,
  warning: 'Severe soreness — recovery session only (40% × 3×5)',
};

/** Normalise legacy 1-5 input to the 1-10 scale. Values > 5 are already on the new scale. */
function normalise(level: number): number {
  return level <= 5 ? level * 2 : level;
}

function lookupMale(level10: number): SorenessModifier {
  if (level10 <= 4) return FRESH;        // 1-4: fresh / mild
  if (level10 <= 6) return MODERATE_MALE; // 5-6: moderate
  if (level10 <= 8) return HIGH_MALE;     // 7-8: high
  return SEVERE;                           // 9-10: severe
}

function lookupFemale(level10: number): SorenessModifier {
  if (level10 <= 4) return FRESH;
  if (level10 <= 6) return MODERATE_MALE; // same as male at moderate
  if (level10 <= 8) return HIGH_FEMALE;   // female-specific at high
  return SEVERE;
}

export function getSorenessModifier(
  sorenessLevel: SorenessLevel,
  biologicalSex?: 'female' | 'male'
): SorenessModifier {
  const level10 = normalise(sorenessLevel);
  return biologicalSex === 'female' ? lookupFemale(level10) : lookupMale(level10);
}

export function applySorenessToSets(
  plannedSets: PlannedSet[],
  modifier: SorenessModifier,
  minSets = 1,
  barWeightKg = 20
): PlannedSet[] {
  if (plannedSets.length === 0) return plannedSets;

  if (modifier.recoveryMode) {
    const recoveryWeight = Math.max(
      barWeightKg,
      roundToNearest(plannedSets[0].weight_kg * 0.4)
    );
    return Array.from({ length: 3 }, (_, i) => ({
      set_number: i + 1,
      weight_kg: recoveryWeight,
      reps: 5,
      rpe_target: 5.0,
    }));
  }

  const targetCount = Math.max(
    minSets,
    plannedSets.length - modifier.setReduction
  );
  const reduced = plannedSets.slice(0, targetCount);

  if (modifier.intensityMultiplier === 1.0) return reduced;

  return reduced.map((s) => ({
    ...s,
    weight_kg: roundToNearest(s.weight_kg * modifier.intensityMultiplier),
  }));
}

const PRIMARY_MUSCLES: Record<Lift, MuscleGroup[]> = {
  squat: ['quads', 'glutes', 'lower_back'],
  bench: ['chest', 'triceps', 'shoulders'],
  deadlift: ['hamstrings', 'glutes', 'lower_back', 'upper_back'],
};

export function getPrimaryMusclesForSession(lift: Lift): MuscleGroup[] {
  return PRIMARY_MUSCLES[lift];
}

export function getWorstSoreness(
  muscles: MuscleGroup[],
  ratings: Partial<Record<MuscleGroup, SorenessLevel>>
): SorenessLevel {
  return muscles.reduce<SorenessLevel>((worst, muscle) => {
    const level = ratings[muscle] ?? 1;
    return (level > worst ? level : worst) as SorenessLevel;
  }, 1);
}
