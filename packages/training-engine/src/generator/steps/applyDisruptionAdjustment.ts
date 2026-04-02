import type { JITInput } from '../jit-session-generator';
import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { PipelineContext } from './pipeline-context';

export function applyDisruptionAdjustment(
  ctx: PipelineContext,
  input: JITInput,
  traceBuilder?: PrescriptionTraceBuilder
) {
  const preCount = ctx.plannedCount;
  const relevantDisruptions = input.activeDisruptions.filter(
    (d) =>
      d.affected_lifts === null ||
      d.affected_lifts.length === 0 ||
      d.affected_lifts.includes(input.primaryLift)
  );

  // Deload sessions are already at recovery-level loading — disruptions
  // should not further reduce or skip them (design/disruption-management.md).
  if (input.intensityType === 'deload') {
    if (relevantDisruptions.length > 0) {
      ctx.rationale.push(
        'Active disruption noted — deload session proceeds unchanged'
      );
    }
    // Still note equipment disruption for aux boost rationale (buildAuxiliaryWork acts on it independently)
    const hasNoEquipmentDisruption = input.activeDisruptions.some(
      (d) => d.disruption_type === 'equipment_unavailable'
    );
    if (hasNoEquipmentDisruption) {
      ctx.rationale.push(
        'No equipment available — auxiliary volume increased with bodyweight compensation exercises'
      );
    }
    return;
  }

  if (relevantDisruptions.length > 0 && !ctx.inRecoveryMode) {
    const severityOrder = { minor: 1, moderate: 2, major: 3 } as const;
    const worst = relevantDisruptions.reduce((w, d) =>
      severityOrder[d.severity] > severityOrder[w.severity] ? d : w
    );
    const desc = worst.description ?? 'Training disruption adjustment';

    if (worst.severity === 'major') {
      ctx.skippedMainLift = true;
      ctx.plannedCount = 0;
      ctx.rationale.push(`${desc} — main lift skipped`);
      traceBuilder?.setSkipped(true);
      traceBuilder?.recordVolumeChange({
        source: 'disruption',
        setsBefore: preCount,
        setsAfter: 0,
        reason: `${desc} — major disruption`,
      });
    } else if (worst.severity === 'moderate') {
      const disruptionSets = Math.max(1, Math.ceil(ctx.baseSets.length / 2));
      ctx.plannedCount = Math.min(ctx.plannedCount, disruptionSets);
      ctx.intensityMultiplier = Math.min(ctx.intensityMultiplier, 0.9);
      ctx.rationale.push(`${desc} — volume and intensity reduced`);
      traceBuilder?.recordModifier({
        source: 'disruption',
        multiplier: 0.9,
        reason: `${desc} — moderate disruption`,
      });
    } else {
      ctx.rationale.push(desc);
    }
  }

  ctx.disruptionSetsRemoved = preCount - ctx.plannedCount;
  if (ctx.disruptionSetsRemoved > 0 && !ctx.skippedMainLift) {
    traceBuilder?.recordVolumeChange({
      source: 'disruption',
      setsBefore: preCount,
      setsAfter: ctx.plannedCount,
      reason: 'Moderate disruption set reduction',
    });
  }

  // Note no-equipment disruption in rationale (aux boost handled in buildAuxiliaryWork)
  const hasNoEquipmentDisruption = input.activeDisruptions.some(
    (d) => d.disruption_type === 'equipment_unavailable'
  );
  if (hasNoEquipmentDisruption) {
    ctx.rationale.push(
      'No equipment available — auxiliary volume increased with bodyweight compensation exercises'
    );
  }
}
