import type { JITInput, RecentSessionSummary } from '../jit-session-generator';
import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { PipelineContext } from './pipeline-context';

// ---------------------------------------------------------------------------
// Constants — tune from prod data
// ---------------------------------------------------------------------------

/** Minimum average RPE deviation to trigger an adjustment */
const OVER_THRESHOLD = 0.75;
const UNDER_THRESHOLD = -0.75;

/** Intensity multipliers: tiered by gap magnitude */
const SMALL_OVER_MULTIPLIER = 0.975; // gap 0.75–1.25: reduce 2.5%
const LARGE_OVER_MULTIPLIER = 0.95; // gap >= 1.25: reduce 5%
const SMALL_UNDER_MULTIPLIER = 1.025; // gap -0.75 to -1.25: boost 2.5%
const LARGE_UNDER_MULTIPLIER = 1.05; // gap <= -1.25: boost 5%

const LARGE_GAP = 1.25;

// ---------------------------------------------------------------------------
// Step 2: RPE adjustment
// ---------------------------------------------------------------------------

export function applyRpeAdjustment(
  ctx: PipelineContext,
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
) {
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

  if (avgDev >= OVER_THRESHOLD) {
    const isLarge = avgDev >= LARGE_GAP;
    const multiplier = isLarge ? LARGE_OVER_MULTIPLIER : SMALL_OVER_MULTIPLIER;
    const pct = isLarge ? '5' : '2.5';
    ctx.intensityMultiplier *= multiplier;
    ctx.rationale.push(`Recent RPE above target — reduced intensity ${pct}%`);
    traceBuilder?.recordModifier({
      source: 'rpe_history',
      multiplier,
      reason: `Recent RPE above target — intensity x${multiplier}`,
    });
  } else if (avgDev <= UNDER_THRESHOLD) {
    const isLarge = avgDev <= -LARGE_GAP;
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
