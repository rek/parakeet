import {
  getPrimaryMusclesForSession,
  getWorstSoreness,
} from '../adjustments/soreness-adjuster';
import {
  effectiveIncrementKg,
  roundToNearest,
} from '../formulas/weight-rounding';
import { createMuscleMapper } from '../volume/muscle-mapper';
import type { JITInput, JITOutput } from './jit-session-generator';
import { applyRehabClamp } from './rehab-clamp';
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
  let cappedByRehab = output.cappedByRehab ?? false;
  let rehabCapKg = output.rehabCapKg;
  const newWarnings = [...warnings];
  const increment = effectiveIncrementKg(input);

  // Formula baseline for this session — the deterministic reference the weight
  // floor, minimum-set, and over-reaction guards all measure against. Computed
  // once here and reused (the args never vary within this pass).
  const baseSets = calculateSets(
    input.primaryLift,
    input.intensityType,
    input.blockNumber,
    input.oneRmKg,
    input.formulaConfig,
    input.weightIncrementKg
  );

  // MRV cap — non-negotiable
  if (!skippedMainLift) {
    const primaryMuscles = getPrimaryMusclesForSession(input.primaryLift);
    // Route through the user-aware mapper for consistency with the rest of
    // the pipeline. For the primary-lift (no `exercise`) path this returns
    // the catalog contributions unchanged.
    const muscleMapper = createMuscleMapper(input.customMuscleMap);
    const liftMuscles = muscleMapper(input.primaryLift);
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
    const baseWeight = baseSets[0]?.weight_kg ?? 0;
    const floorWeight = roundToNearest(baseWeight * 0.4, increment);
    mainLiftSets = mainLiftSets.map((s) => ({
      ...s,
      weight_kg: Math.max(s.weight_kg, floorWeight),
    }));
  }

  // Minimum sets — if not skipped, must have ≥1 working set
  if (!skippedMainLift && mainLiftSets.length === 0) {
    if (baseSets.length > 0) {
      mainLiftSets = [baseSets[0]];
      newWarnings.push('[constraint] Minimum 1 working set enforced');
    }
  }

  // Over-reaction guard (LLM/hybrid). The documented adjustment envelope
  // (docs/domain/adjustments.md) caps a no-disruption, non-severe-soreness day
  // at −1 set and ×0.95 intensity — even the worst subjective case (sleep AND
  // energy both 1–2) stays inside it. The LLM strategy has stacked a large
  // intensity cut AND a large volume cut on neutral/mild days with only generic
  // rationale (prod deadlift 79cf94f5: no disruption, soreness < 7 → 4 sets ×
  // 100kg cut to 1 set × 85kg). When no strong objective signal justifies it,
  // clamp the combined reduction back toward that envelope. Strong signals — an
  // active disruption or primary-muscle soreness ≥ 7 — bypass the guard; deload
  // is an intentional reduction and is exempt. Subjective readiness never
  // bypasses, because its own documented ceiling is already inside the envelope.
  const isDeload = input.intensityType === 'deload';
  const hasDisruption = (input.activeDisruptions?.length ?? 0) > 0;
  const worstSoreness = getWorstSoreness(
    getPrimaryMusclesForSession(input.primaryLift),
    input.sorenessRatings
  );
  const strongSignal = hasDisruption || worstSoreness >= 7;
  if (!skippedMainLift && !isDeload && !strongSignal && mainLiftSets.length > 0) {
    const baseCount = baseSets.length;
    const baseWeight = baseSets[0]?.weight_kg ?? 0;
    const curWeight = mainLiftSets[0].weight_kg;
    const bigVolumeCut = mainLiftSets.length <= baseCount - 2;
    const bigIntensityCut = baseWeight > 0 && curWeight < baseWeight * 0.9;
    if (bigVolumeCut && bigIntensityCut) {
      // Restore to the documented single-axis ceiling: at most −1 set, weight
      // floored at 95% of the formula baseline. Keep whatever the LLM chose if
      // it was already gentler than the floor. Overwriting every set's weight
      // with one flooredWeight is safe because formula main-lift sets are
      // uniform-weight straight sets (see set-calculator); revisit if ramped.
      const restoredCount = Math.max(mainLiftSets.length, baseCount - 1);
      const flooredWeight = Math.max(
        curWeight,
        roundToNearest(baseWeight * 0.95, increment)
      );
      mainLiftSets = baseSets.slice(0, restoredCount).map((s, i) => ({
        ...s,
        set_number: i + 1,
        weight_kg: flooredWeight,
      }));
      newWarnings.push(
        `[constraint] Over-reaction guard: no disruption and soreness < 7 — combined volume + intensity cut clamped to formula envelope (restored to ${restoredCount} set(s) @ ${flooredWeight}kg)`
      );
    }
  }

  // Weight rounding — to the lifter's smallest reachable plate increment
  // (GH#209). Defaults to 2.5kg when no plate constraint is given.
  mainLiftSets = mainLiftSets.map((s) => ({
    ...s,
    weight_kg: roundToNearest(s.weight_kg, increment),
  }));

  // Rehab Mode cap (GH#220) — non-negotiable ceiling. Applied here so the LLM
  // and hybrid strategies honor the cap even though they bypass
  // buildFinalMainSets. Without this, a user with a cap on squat would get
  // capped weights under the formula strategy but not under the LLM strategy.
  if (mainLiftSets.length > 0) {
    let anyClamped = false;
    let ceiling: number | null = null;
    mainLiftSets = mainLiftSets.map((s) => {
      const clamp = applyRehabClamp(s.weight_kg, input, increment);
      if (clamp.cappedByRehab) {
        anyClamped = true;
        ceiling = clamp.rehabCapKg;
      }
      return { ...s, weight_kg: clamp.finalWeightKg };
    });
    if (anyClamped && !cappedByRehab) {
      cappedByRehab = true;
      rehabCapKg = ceiling ?? rehabCapKg;
      newWarnings.push(`[constraint] Capped at ${ceiling}kg by Rehab Mode`);
    }
  }

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
    ...(cappedByRehab && rehabCapKg != null
      ? { cappedByRehab: true, rehabCapKg }
      : {}),
  };
}
