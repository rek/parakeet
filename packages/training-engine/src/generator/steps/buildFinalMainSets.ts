import type { PlannedSet } from '@parakeet/shared-types';

import { roundToNearest } from '../../formulas/weight-rounding';
import type { JITInput } from '../jit-session-generator';
import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { PipelineContext } from './pipeline-context';

export function buildFinalMainSets(
  ctx: PipelineContext,
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
): PlannedSet[] {
  const barWeightKg = input.barWeightKg ?? 20;

  if (ctx.inRecoveryMode) {
    const recoveryWeight = Math.max(
      barWeightKg,
      roundToNearest(ctx.baseWeight * 0.4)
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

  const finalWeight = roundToNearest(ctx.baseWeight * ctx.intensityMultiplier);
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
