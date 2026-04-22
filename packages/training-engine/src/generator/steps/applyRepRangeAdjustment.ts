import type { JITInput } from '../jit-session-generator';
import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { PipelineContext } from './pipeline-context';
import { computeAvgRpeDev, RPE_LARGE_GAP } from './rpe-history-thresholds';

// ---------------------------------------------------------------------------
// Step 2b: Rep range adjustment (Rep days only)
//
// Only fires on strong below-target signal (avgDev <= -RPE_LARGE_GAP).
// Mild signal (-0.75 to -1.25) is handled by the weight boost in step 2
// alone — adding reps on top would compound to a ~25% total-work increase
// from a 2-session mild signal.
// Strong signal (≤ -1.25): prescribe reps_max.
// Disruption (step 7) can still reduce reps downward after this step.
// ---------------------------------------------------------------------------

export function applyRepRangeAdjustment(
  ctx: PipelineContext,
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
): void {
  if (input.intensityType !== 'rep') return;
  if (ctx.inRecoveryMode || ctx.skippedMainLift) return;

  const avgDev = computeAvgRpeDev(input.recentLogs);
  if (avgDev === null || avgDev > -RPE_LARGE_GAP) return;

  let firstAdjustedReps: number | null = null;
  for (const set of ctx.baseSets) {
    if (!set.reps_range) continue;
    const target = set.reps_range[1]; // reps_max
    if (target !== set.reps) {
      set.reps = target;
      firstAdjustedReps ??= target;
    }
  }

  if (firstAdjustedReps !== null) {
    ctx.rationale.push(
      `Recent RPE well below target — prescribing ${firstAdjustedReps} reps`
    );
    traceBuilder?.recordModifier({
      source: 'rpe_history',
      multiplier: 1,
      reason: `Rep range adjusted: strong RPE below target → reps_max (${firstAdjustedReps})`,
    });
  }
}
