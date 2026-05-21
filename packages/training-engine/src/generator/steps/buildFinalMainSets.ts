import type { PlannedSet } from '@parakeet/shared-types';

import {
  effectiveIncrementKg,
  roundToNearest,
  roundUpToNearest,
} from '../../formulas/weight-rounding';
import type { JITInput } from '../jit-session-generator';
import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { PipelineContext } from './pipeline-context';

/** Resolve the effective working-weight ceiling for this session. When a rehab
 *  cap is active for this lift, the cap is rounded UP to the lifter's plate
 *  increment (GH#220) — the lifter chose the cap knowing their plate set, so
 *  rounding down would silently lose meaningful work. Returns `null` when no
 *  cap is active. */
function resolveRehabCeilingKg(
  input: JITInput,
  increment: number
): number | null {
  if (!input.activeRehabCap) return null;
  if (input.activeRehabCap.lift !== input.primaryLift) return null;
  return roundUpToNearest(input.activeRehabCap.capKg, increment);
}

export function buildFinalMainSets(
  ctx: PipelineContext,
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
): PlannedSet[] {
  const barWeightKg = input.barWeightKg ?? 20;
  const increment = effectiveIncrementKg(input);
  const rehabCeiling = resolveRehabCeilingKg(input, increment);

  if (ctx.inRecoveryMode) {
    // Recovery mode floor is 40% of base. When a rehab cap is active, base
    // recovery work off the (clamped) cap rather than the uncapped formula
    // weight — a 60kg-capped squat shouldn't generate 40% of 100kg.
    const recoveryBasis =
      rehabCeiling !== null
        ? Math.min(ctx.baseWeight, rehabCeiling)
        : ctx.baseWeight;
    const recoveryWeight = Math.max(
      barWeightKg,
      roundToNearest(recoveryBasis * 0.4, increment)
    );
    const sets: PlannedSet[] = Array.from({ length: 3 }, (_, i) => ({
      set_number: i + 1,
      weight_kg: recoveryWeight,
      reps: 5,
      rpe_target: 5.0,
    }));
    traceBuilder?.setFinalWeight(recoveryWeight);
    traceBuilder?.recordSets(
      sets.map((s) => ({
        setNumber: s.set_number,
        weightKg: s.weight_kg,
        reps: s.reps,
        rpeTarget: s.rpe_target ?? 0,
        repSource: 'recovery mode (3x5 @ RPE 5)',
      }))
    );
    return sets;
  }

  if (ctx.skippedMainLift || ctx.plannedCount === 0) {
    return [];
  }

  const formulaWeight = roundToNearest(
    ctx.baseWeight * ctx.intensityMultiplier,
    increment
  );
  // Rehab Mode (GH#220): clamp the prescribed weight to the cap. The cap is
  // a ceiling — any modifier (readiness, soreness, cycle, disruption) that
  // already reduced weight below the cap still applies as-is. Only the upper
  // bound is touched.
  const cappedByRehab = rehabCeiling !== null && formulaWeight > rehabCeiling;
  const finalWeight = cappedByRehab ? rehabCeiling! : formulaWeight;
  if (cappedByRehab) {
    ctx.cappedByRehab = true;
    ctx.rehabCapKg = rehabCeiling;
    ctx.rationale.push(`Capped at ${rehabCeiling}kg by Rehab Mode`);
  }
  const sets = ctx.baseSets.slice(0, ctx.plannedCount).map((s, i) => ({
    ...s,
    set_number: i + 1,
    weight_kg: finalWeight,
  }));

  traceBuilder?.setFinalWeight(finalWeight);
  traceBuilder?.recordSets(
    sets.map((s) => ({
      setNumber: s.set_number,
      weightKg: s.weight_kg,
      reps: s.reps,
      rpeTarget: s.rpe_target ?? 0,
      repSource: `block${((input.blockNumber - 1) % 3) + 1}.${input.intensityType} config`,
    }))
  );

  return sets;
}
