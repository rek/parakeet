import type { Lift, PlannedSet } from '@parakeet/shared-types';

import {
  computeAuxWeight,
  getRepTarget,
} from '../../auxiliary/exercise-catalog';
import { ExerciseType, getExerciseType } from '../../auxiliary/exercise-types';
import { roundToNearest } from '../../formulas/weight-rounding';
import type { SorenessLevel } from '../../adjustments/soreness-adjuster';
import type { MuscleGroup, MrvMevConfig } from '../../types';
import type { AuxiliaryWork } from '../jit-session-generator';

export function processAuxExercise({
  exercise,
  worstSoreness,
  primaryMuscles,
  weeklyVolumeToDate,
  mrvMevConfig,
  mainLiftSetCount,
  oneRmKg,
  biologicalSex,
  hasNoEquipment,
  warnings,
  primaryLift,
}: {
  exercise: string;
  worstSoreness: SorenessLevel;
  primaryMuscles: MuscleGroup[];
  weeklyVolumeToDate: Partial<Record<MuscleGroup, number>>;
  mrvMevConfig: MrvMevConfig;
  mainLiftSetCount: number;
  oneRmKg: number;
  biologicalSex?: 'female' | 'male';
  hasNoEquipment: boolean;
  warnings: string[];
  primaryLift: Lift;
}): AuxiliaryWork {
  const exerciseType = getExerciseType(exercise);

  // Soreness 5: skip entirely
  if (worstSoreness >= 5) {
    return {
      exercise,
      exerciseType,
      sets: [],
      skipped: true,
      skipReason: 'Severe soreness — auxiliary exercise skipped',
    };
  }

  // Timed exercises are not load-bearing — skip MRV check
  if (exerciseType !== 'timed') {
    for (const muscle of primaryMuscles) {
      const weeklyVol = weeklyVolumeToDate[muscle] ?? 0;
      const { mrv } = mrvMevConfig[muscle];
      const remaining = mrv - weeklyVol - mainLiftSetCount;
      if (remaining < 1) {
        warnings.push(`Approaching MRV for ${muscle} — ${exercise} skipped`);
        return {
          exercise,
          exerciseType,
          sets: [],
          skipped: true,
          skipReason: `MRV approaching for ${muscle}`,
        };
      }
    }
  }

  // Timed exercises: single "set" with weight 0, reps 0 — UI renders as mark-complete
  if (exerciseType === 'timed') {
    return {
      exercise,
      exerciseType,
      sets: [{ set_number: 1, weight_kg: 0, reps: 0, rpe_target: 7.0 }],
      skipped: false,
    };
  }

  // Base: per-exercise rep target (falls back to 10 male / 12 female)
  const baseReps = biologicalSex === 'female' ? 12 : 10;
  const reps = getRepTarget(exercise, baseReps);
  let setCount = 3;
  let intensityMult = 1.0;

  if (worstSoreness === 4) {
    setCount = Math.max(1, setCount - 1);
    intensityMult = 0.95;
  } else if (worstSoreness === 3) {
    setCount = Math.max(1, setCount - 1);
  }

  // No-equipment disruption: add an extra set to compensate for reduced barbell work
  if (hasNoEquipment) {
    setCount += 1;
  }

  // Bodyweight: no load — weight 0, reps only
  const finalWeight =
    exerciseType === 'bodyweight'
      ? 0
      : roundToNearest(
          roundToNearest(
            computeAuxWeight({ exercise, oneRmKg, lift: primaryLift, biologicalSex })
          ) * intensityMult
        );

  const sets: PlannedSet[] = Array.from({ length: setCount }, (_, i) => ({
    set_number: i + 1,
    weight_kg: finalWeight,
    reps,
    rpe_target: 7.5,
  }));

  return { exercise, exerciseType, sets, skipped: false };
}
