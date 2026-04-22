import type { JITInput } from '../jit-session-generator';
import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { PipelineContext } from './pipeline-context';
import {
  computeAvgRpeDev,
  LARGE_OVER_MULTIPLIER,
  LARGE_UNDER_MULTIPLIER,
  RPE_LARGE_GAP,
  RPE_OVER_THRESHOLD,
  RPE_UNDER_THRESHOLD,
  SMALL_OVER_MULTIPLIER,
  SMALL_UNDER_MULTIPLIER,
} from './rpe-history-thresholds';

// ---------------------------------------------------------------------------
// Step 2: RPE adjustment
// ---------------------------------------------------------------------------

export function applyRpeAdjustment(
  ctx: PipelineContext,
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
) {
  const avgDev = computeAvgRpeDev(input.recentLogs);
  if (avgDev === null) return;

  if (avgDev >= RPE_OVER_THRESHOLD) {
    const isLarge = avgDev >= RPE_LARGE_GAP;
    const multiplier = isLarge ? LARGE_OVER_MULTIPLIER : SMALL_OVER_MULTIPLIER;
    const pct = isLarge ? '5' : '2.5';
    ctx.intensityMultiplier *= multiplier;
    ctx.rationale.push(`Recent RPE above target — reduced intensity ${pct}%`);
    traceBuilder?.recordModifier({
      source: 'rpe_history',
      multiplier,
      reason: `Recent RPE above target — intensity x${multiplier}`,
    });
  } else if (avgDev <= RPE_UNDER_THRESHOLD) {
    const isLarge = avgDev <= -RPE_LARGE_GAP;
    const multiplier = isLarge
      ? LARGE_UNDER_MULTIPLIER
      : SMALL_UNDER_MULTIPLIER;
    const pct = isLarge ? '5' : '2.5';
    ctx.intensityMultiplier *= multiplier;
    ctx.rationale.push(`Recent RPE below target — increased intensity ${pct}%`);
    traceBuilder?.recordModifier({
      source: 'rpe_history',
      multiplier,
      reason: `Recent RPE below target — intensity x${multiplier}`,
    });
  }
}
