import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { JITInput, RecentSessionSummary } from '../jit-session-generator';
import type { PipelineContext } from './pipeline-context';

export function applyRpeAdjustment(ctx: PipelineContext, input: JITInput, traceBuilder?: PrescriptionTraceBuilder) {
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

  if (avgDev >= 1.0) {
    ctx.intensityMultiplier *= 0.975;
    ctx.rationale.push('Recent RPE above target — reduced intensity 2.5%');
    traceBuilder?.recordModifier({ source: 'rpe_history', multiplier: 0.975, reason: 'Recent RPE above target — intensity x0.975' });
  } else if (avgDev <= -1.0) {
    ctx.intensityMultiplier *= 1.025;
    ctx.rationale.push('Recent RPE below target — increased intensity 2.5%');
    traceBuilder?.recordModifier({ source: 'rpe_history', multiplier: 1.025, reason: 'Recent RPE below target — intensity x1.025' });
  }
}
