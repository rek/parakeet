import type { Lift, PlannedSet } from '@parakeet/shared-types';

import type { SorenessLevel } from '../../adjustments/soreness-adjuster';
import {
  computeAuxWeight,
  getRepTarget,
} from '../../auxiliary/exercise-catalog';
import { ExerciseType, getExerciseType } from '../../auxiliary/exercise-types';
import { roundToNearest } from '../../formulas/weight-rounding';
import type { MrvMevConfig, MuscleGroup } from '../../types';
import {
  getMusclesForExercise,
  getMusclesForLift,
} from '../../volume/muscle-mapper';
import type { AuxiliaryWork } from '../jit-session-generator';

/** Fraction of weight retained when aux shares muscles with the session's main lift.
 *  Prod data: compound aux after heavy main (e.g. CGBP after bench) shows RPE 9.5-10
 *  with the standard weight; 15% discount aligns with observed fatigue effect. */
const POST_MAIN_FATIGUE_FACTOR = 0.85;

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

  // Soreness 9-10 (severe): skip entirely
  if (worstSoreness >= 9) {
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

  // Post-main-lift fatigue discount: if the aux exercise shares muscles with the
  // primary lift (at ≥0.5 contribution), the lifter is pre-fatigued from main work.
  // Prod data shows RPE 9.5-10 on compound aux (e.g. CGBP after bench) without this.
  if (mainLiftSetCount > 0) {
    const mainLiftMuscles = new Set(
      getMusclesForLift(primaryLift).map((m) => m.muscle)
    );
    const auxMuscles = getMusclesForExercise(exercise);
    const hasOverlap = auxMuscles.some(
      (m) => m.contribution >= 0.5 && mainLiftMuscles.has(m.muscle)
    );
    if (hasOverlap) {
      intensityMult *= POST_MAIN_FATIGUE_FACTOR;
    }
  }

  if (worstSoreness >= 7) {
    // High soreness (7-8): reduce sets and intensity
    setCount = Math.max(1, setCount - 1);
    intensityMult *= 0.95;
  } else if (worstSoreness >= 5) {
    // Moderate soreness (5-6): reduce sets only
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
            computeAuxWeight({
              exercise,
              oneRmKg,
              lift: primaryLift,
              biologicalSex,
            })
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
