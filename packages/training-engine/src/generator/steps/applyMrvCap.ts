import { createMuscleMapper } from '../../volume/muscle-mapper';
import type { JITInput } from '../jit-session-generator';
import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { PipelineContext } from './pipeline-context';

export function applyMrvCap(
  ctx: PipelineContext,
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
) {
  if (ctx.inRecoveryMode) return;

  // Route the primary-lift lookup through the user-aware mapper so the MRV
  // step behaves consistently with the rest of the pipeline. The catalog
  // muscle contributions for squat/bench/deadlift are unaffected; the wiring
  // exists so a future call site that passes an `exercise` argument picks up
  // the user's custom muscle map without a second refactor.
  const muscleMapper = createMuscleMapper(input.customMuscleMap);
  const liftMuscles = muscleMapper(input.primaryLift);
  for (const { muscle, contribution } of liftMuscles) {
    if (!ctx.primaryMuscles.includes(muscle)) continue;
    const weeklyVol = input.weeklyVolumeToDate[muscle] ?? 0;
    const { mrv } = input.mrvMevConfig[muscle];
    const remainingCapacity = mrv - weeklyVol;

    if (remainingCapacity <= 0) {
      ctx.skippedMainLift = true;
      const prevCount = ctx.plannedCount;
      ctx.plannedCount = 0;
      ctx.warnings.push(`MRV exceeded for ${muscle} — main lift skipped`);
      traceBuilder?.setSkipped(true);
      traceBuilder?.recordVolumeChange({
        source: 'mrv_cap',
        setsBefore: prevCount,
        setsAfter: 0,
        reason: `MRV exceeded for ${muscle}`,
      });
      break;
    }

    const remainingSets = Math.floor(remainingCapacity / contribution);
    if (ctx.plannedCount > remainingSets) {
      const prevCount = ctx.plannedCount;
      ctx.warnings.push(
        `Approaching MRV for ${muscle} — sets capped at ${remainingSets}`
      );
      ctx.plannedCount = remainingSets;
      traceBuilder?.recordVolumeChange({
        source: 'mrv_cap',
        setsBefore: prevCount,
        setsAfter: remainingSets,
        reason: `MRV cap for ${muscle}`,
      });
    }
  }
}
