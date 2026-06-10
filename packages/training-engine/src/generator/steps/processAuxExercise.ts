import type { IntensityType, Lift, PlannedSet } from '@parakeet/shared-types';

import type { SorenessLevel } from '../../adjustments/soreness-adjuster';
import { AuxAnchorResult, toAnchorCarrier } from '../../auxiliary/anchor';
import {
  computeAuxWeight,
  getRepTarget,
} from '../../auxiliary/exercise-catalog';
import type { ExerciseType } from '../../auxiliary/exercise-types';
import { getExerciseType } from '../../auxiliary/exercise-types';
import { roundToNearest } from '../../formulas/weight-rounding';
import type { MrvMevConfig, MuscleGroup, MuscleMapper } from '../../types';
import type { AuxiliaryWork } from '../jit-session-generator';

/** Fraction of weight retained when aux shares muscles with the session's main lift.
 *  Prod data: compound aux after heavy main (e.g. CGBP after bench at 80%+ RPE 8.5)
 *  shows RPE 9.5-10 with the standard weight; 15% discount aligns with observed
 *  fatigue effect. Lower-intensity main work generates proportionally less fatigue,
 *  so the discount tapers toward 1.0 on rep/explosive/deload days. */
export function getPostMainFatigueFactor(intensityType: IntensityType): number {
  switch (intensityType) {
    case 'heavy':
      return 0.85;
    case 'rep':
      return 0.9;
    case 'explosive':
      return 0.95;
    case 'deload':
      return 1.0;
  }
}

/** Aux scaling for deload sessions (GH#231). Without this, deloads only
 *  reduce the main lift — aux exercises keep their full anchor/formula
 *  weight and set count, which is heavier total work than a normal session
 *  once the cut main lift is subtracted. Empirically a deload aux at ~50%
 *  intensity / 2 sets keeps the recovery-week intent intact while preserving
 *  the movement pattern. */
export const DELOAD_AUX_INTENSITY_RATIO = 0.5;
export const DELOAD_AUX_VOLUME_RATIO = 0.67;

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
  muscleMapper,
  weightIncrementKg = 2.5,
  exerciseTyper = getExerciseType,
  mainLiftVolumeRatio = 1.0,
  mainIntensityMultiplier = 1.0,
  skippedMainLift = false,
  intensityType = 'heavy',
  anchorResult,
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
  muscleMapper: MuscleMapper;
  weightIncrementKg?: number;
  /** Type resolver that honours user-defined custom exercise types.
   *  Defaults to the catalog-only `getExerciseType` for legacy callers. */
  exerciseTyper?: (name: string) => ExerciseType;
  /** Final / base set ratio for the main lift after all pipeline modifiers
   *  (readiness, cycle, soreness, disruption, RPE history). Aux set count is
   *  scaled by this ratio so penalty signals propagate proportionally instead
   *  of stopping at the main lift. Clamped to [0,1] — calibration boosts on
   *  the main lift do not increase aux volume. See GH#217. */
  mainLiftVolumeRatio?: number;
  /** Cumulative main-lift intensity multiplier from the pipeline. Applied to
   *  aux weight on top of the existing post-main-fatigue factor. Clamped to
   *  [0,1] for the same asymmetric reason as mainLiftVolumeRatio. */
  mainIntensityMultiplier?: number;
  /** True when the main lift was skipped (major disruption). Aux is suppressed
   *  rather than left to dominate a session the engine just bailed on. */
  skippedMainLift?: boolean;
  /** Drives the post-main-fatigue factor: heavy main = bigger discount, speed
   *  main = almost none. Defaults to 'heavy' so legacy callers retain the
   *  historical 0.85 behavior. */
  intensityType?: IntensityType;
  /** History-anchored weight result (GH#221). When source is 'history' or
   *  'snap', the anchor base is used directly and the post-main fatigue
   *  discount is skipped because the historical sets were themselves logged
   *  after main work — the fatigue context is already baked in. For 'blend'
   *  and 'formula' sources, the existing formula path runs (with fatigue
   *  discount applied), because the anchor is not yet fully trusted. */
  anchorResult?: AuxAnchorResult;
}): AuxiliaryWork {
  const exerciseType = exerciseTyper(exercise);
  const useHistoryAnchor =
    anchorResult != null &&
    (anchorResult.source === 'history' || anchorResult.source === 'snap');
  const anchorMeta: AuxiliaryWork['anchor'] | undefined = anchorResult
    ? toAnchorCarrier(anchorResult)
    : undefined;

  // Main lift skipped (major disruption): suppress aux so the session isn't
  // dominated by accessories the engine intentionally bailed out of.
  if (skippedMainLift) {
    return {
      exercise,
      exerciseType,
      sets: [],
      skipped: true,
      skipReason: 'Main lift skipped — auxiliary suppressed',
      anchor: anchorMeta,
    };
  }

  // Soreness 9-10 (severe): skip entirely
  if (worstSoreness >= 9) {
    return {
      exercise,
      exerciseType,
      sets: [],
      skipped: true,
      skipReason: 'Severe soreness — auxiliary exercise skipped',
      anchor: anchorMeta,
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
          anchor: anchorMeta,
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
      anchor: anchorMeta,
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
  // GH#221: skipped once history anchor is established — the historical sets were
  // logged in the same fatigue context, so applying the discount again would
  // double-count. Still applies during cold-start ('formula') and blend phase.
  if (mainLiftSetCount > 0 && !useHistoryAnchor) {
    const mainLiftMuscles = new Set(
      muscleMapper(primaryLift).map((m) => m.muscle)
    );
    const auxMuscles = muscleMapper(null, exercise);
    const hasOverlap = auxMuscles.some(
      (m) => m.contribution >= 0.5 && mainLiftMuscles.has(m.muscle)
    );
    if (hasOverlap) {
      intensityMult *= getPostMainFatigueFactor(intensityType);
    }
  }

  // GH#217: propagate ALL main-lift modifiers (readiness, cycle, soreness,
  // disruption, RPE history) to aux proportionally. This replaces the prior
  // soreness-only aux reduction; the soreness contribution now flows through
  // via mainLiftVolumeRatio + mainIntensityMultiplier just like every other
  // signal. Clamp to ≤1 so calibration-driven main-lift boosts don't inflate
  // aux volume — the volume top-up step handles MEV-driven additions.
  const volumeRatio = Math.min(1, Math.max(0, mainLiftVolumeRatio));
  const intensityRatio = Math.min(1, Math.max(0, mainIntensityMultiplier));
  setCount = Math.max(1, Math.round(setCount * volumeRatio));
  intensityMult *= intensityRatio;

  // No-equipment disruption: add an extra set to compensate for reduced barbell work
  if (hasNoEquipment) {
    setCount += 1;
  }

  // GH#221: when history anchor is in play (source = history|snap), pass the
  // anchor as `anchorKg` so computeAuxWeight returns it directly. When source
  // is 'blend' or 'formula', the anchor blends into formulaWeightKg upstream;
  // here we still use the formula path so plate rounding + intensityMult run
  // exactly like before. (For 'blend', `anchorResult.anchorKg` is the blended
  // value — pass it as anchorKg so the blend reaches the final weight.)
  const anchorPassthrough =
    anchorResult != null && anchorResult.source !== 'formula'
      ? anchorResult.anchorKg
      : undefined;

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
              anchorKg: anchorPassthrough,
            }),
            weightIncrementKg
          ) * intensityMult,
          weightIncrementKg
        );

  const sets: PlannedSet[] = Array.from({ length: setCount }, (_, i) => ({
    set_number: i + 1,
    weight_kg: finalWeight,
    reps,
    rpe_target: 7.5,
  }));

  return { exercise, exerciseType, sets, skipped: false, anchor: anchorMeta };
}
