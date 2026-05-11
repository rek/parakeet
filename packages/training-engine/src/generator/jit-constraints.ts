import { getPrimaryMusclesForSession } from '../adjustments/soreness-adjuster';
import {
  effectiveIncrementKg,
  roundToNearest,
} from '../formulas/weight-rounding';
import { getMusclesForLift } from '../volume/muscle-mapper';
import type { JITInput, JITOutput } from './jit-session-generator';
import { calculateSets } from './set-calculator';
import {
  generateWarmupSets,
  resolveEffectiveWarmupProtocol,
} from './warmup-calculator';

export function enforceHardConstraints(
  output: JITOutput,
  input: JITInput
): JITOutput {
  let { mainLiftSets, skippedMainLift, warnings } = output;
  const newWarnings = [...warnings];
  const increment = effectiveIncrementKg(input);

  // MRV cap — non-negotiable
  if (!skippedMainLift) {
    const primaryMuscles = getPrimaryMusclesForSession(input.primaryLift);
    const liftMuscles = getMusclesForLift(input.primaryLift);
    for (const { muscle } of liftMuscles) {
      if (!primaryMuscles.includes(muscle)) continue;
      const weeklyVol = input.weeklyVolumeToDate[muscle] ?? 0;
      const { mrv } = input.mrvMevConfig[muscle];
      if (weeklyVol >= mrv) {
        skippedMainLift = true;
        mainLiftSets = [];
        newWarnings.push(
          `[constraint] MRV exceeded for ${muscle} — main lift forced skip`
        );
        break;
      }
    }
  }

  // Weight floor — guard against LLM hallucination
  if (!skippedMainLift && mainLiftSets.length > 0) {
    const baseSets = calculateSets(
      input.primaryLift,
      input.intensityType,
      input.blockNumber,
      input.oneRmKg,
      input.formulaConfig,
      input.weightIncrementKg
    );
    const baseWeight = baseSets[0]?.weight_kg ?? 0;
    const floorWeight = roundToNearest(baseWeight * 0.4, increment);
    mainLiftSets = mainLiftSets.map((s) => ({
      ...s,
      weight_kg: Math.max(s.weight_kg, floorWeight),
    }));
  }

  // Minimum sets — if not skipped, must have ≥1 working set
  if (!skippedMainLift && mainLiftSets.length === 0) {
    const baseSets = calculateSets(
      input.primaryLift,
      input.intensityType,
      input.blockNumber,
      input.oneRmKg,
      input.formulaConfig,
      input.weightIncrementKg
    );
    if (baseSets.length > 0) {
      mainLiftSets = [baseSets[0]];
      newWarnings.push('[constraint] Minimum 1 working set enforced');
    }
  }

  // Weight rounding — to the lifter's smallest reachable plate increment
  // (GH#209). Defaults to 2.5kg when no plate constraint is given.
  mainLiftSets = mainLiftSets.map((s) => ({
    ...s,
    weight_kg: roundToNearest(s.weight_kg, increment),
  }));

  // Warmup — always formula-generated from working weight
  let { warmupSets } = output;
  if (mainLiftSets.length > 0 && !skippedMainLift) {
    const effectiveProtocol = resolveEffectiveWarmupProtocol({
      workingWeightKg: mainLiftSets[0].weight_kg,
      warmupConfig: input.warmupConfig,
      warmupConfigExplicit: input.warmupConfigExplicit,
      primaryLift: input.primaryLift,
      sorenessRatings: input.sorenessRatings,
      biologicalSex: input.biologicalSex,
    });
    warmupSets = generateWarmupSets(
      mainLiftSets[0].weight_kg,
      effectiveProtocol,
      input.barWeightKg,
      input.weightIncrementKg
    );
  } else {
    warmupSets = [];
  }

  return {
    ...output,
    mainLiftSets,
    warmupSets,
    skippedMainLift,
    warnings: newWarnings,
  };
}
