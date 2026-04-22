import type { JITInput, RecentSessionSummary } from '../jit-session-generator';
import type { PipelineContext } from './pipeline-context';

// ---------------------------------------------------------------------------
// Constants — mirrors applyRpeAdjustment thresholds
// ---------------------------------------------------------------------------

/** Minimum RPE below target to trigger any rep adjustment */
const UNDER_SMALL = -0.75;
/** RPE below target to prescribe reps_max instead of middle */
const UNDER_LARGE = -1.25;

// ---------------------------------------------------------------------------
// Step 2b: Rep range adjustment (Rep days only)
//
// applyRpeAdjustment already handles weight for the weak signal (-0.75 to -1.25).
// This step fires only on the same signal; it does NOT fire above UNDER_SMALL
// to avoid double-counting a mild signal with both more weight and more reps.
// Strong signal (≤ UNDER_LARGE) → reps_max.
// Mild signal (UNDER_LARGE to UNDER_SMALL) → middle of range.
// Disruption (step 7) can still override reps downward after this step.
// ---------------------------------------------------------------------------

export function applyRepRangeAdjustment(
  ctx: PipelineContext,
  input: JITInput
): void {
  if (input.intensityType !== 'rep') return;
  if (ctx.inRecoveryMode || ctx.skippedMainLift) return;

  const rpeHistory = input.recentLogs
    .filter(
      (l): l is RecentSessionSummary & { actual_rpe: number } =>
        l.actual_rpe !== null
    )
    .slice(0, 2);

  if (rpeHistory.length < 2) return;

  const avgDev =
    rpeHistory.reduce((s, l) => s + (l.actual_rpe - l.target_rpe), 0) /
    rpeHistory.length;

  if (avgDev > UNDER_SMALL) return;

  let adjusted = false;
  for (const set of ctx.baseSets) {
    if (!set.reps_range) continue;
    const [min, max] = set.reps_range;
    const target =
      avgDev <= UNDER_LARGE ? max : Math.floor((min + max) / 2);
    if (target !== set.reps) {
      set.reps = target;
      adjusted = true;
    }
  }

  if (adjusted) {
    const prescribedReps = ctx.baseSets[0]?.reps ?? 0;
    const label = avgDev <= UNDER_LARGE ? 'well below' : 'below';
    ctx.rationale.push(
      `Recent RPE ${label} target — prescribing ${prescribedReps} reps`
    );
  }
}
