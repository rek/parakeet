import { suggestDisruptionAdjustment } from '../../adjustments/disruption-adjuster';
import type { JITInput } from '../jit-session-generator';
import type { PrescriptionTraceBuilder } from '../prescription-trace';
import type { PipelineContext } from './pipeline-context';

/** Build a human-readable disruption rationale from `type (severity)`,
 *  appending the user's free-text description only when it adds information
 *  (length > 8 chars filters out single words like "knee", "back"). */
function buildDisruptionRationale(disruption: {
  disruption_type: string;
  severity: string;
  description: string | null;
}): string {
  const base = `${disruption.disruption_type} (${disruption.severity})`;
  const desc = disruption.description?.trim();
  return desc && desc.length > 8 ? `${base}: ${desc}` : base;
}

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
    const rationale = buildDisruptionRationale(worst);

    if (worst.severity === 'major') {
      ctx.skippedMainLift = true;
      ctx.plannedCount = 0;
      ctx.rationale.push(`${rationale} — main lift skipped`);
      traceBuilder?.setSkipped(true);
      traceBuilder?.recordVolumeChange({
        source: 'disruption',
        setsBefore: preCount,
        setsAfter: 0,
        reason: `${rationale} — major disruption`,
      });
    } else {
      // Derive the canonical reduction_pct from the off-pipeline adjuster so
      // engine and on-screen previews agree (e.g. moderate injury → -40%,
      // not -10%). Use a placeholder session id — the adjuster returns one
      // entry per (disruption, session) pair; we only need the suggestion.
      const suggestions = suggestDisruptionAdjustment(worst, [
        { id: 'pipeline', primary_lift: input.primaryLift, status: 'planned' },
      ]);
      const weightSuggestion = suggestions.find(
        (s) => s.action === 'weight_reduced' && s.reduction_pct != null
      );

      if (worst.severity === 'moderate') {
        const disruptionSets = Math.max(1, Math.ceil(preCount / 2));
        ctx.plannedCount = Math.min(ctx.plannedCount, disruptionSets);
      }

      if (weightSuggestion?.reduction_pct != null) {
        const reductionPct = weightSuggestion.reduction_pct;
        const multiplier = 1 - reductionPct / 100;
        ctx.intensityMultiplier = Math.min(ctx.intensityMultiplier, multiplier);
        ctx.rationale.push(
          `${rationale} — intensity reduced ${reductionPct}%${worst.severity === 'moderate' ? ', volume reduced' : ''}`
        );
        traceBuilder?.recordModifier({
          source: 'disruption',
          multiplier,
          reason: `${rationale} — ${worst.severity} disruption`,
        });
      } else {
        // Disruption types that the canonical adjuster doesn't translate into
        // a weight cut (equipment_unavailable, unprogrammed_event, illness
        // minor with reps-only suggestion, other) get a rationale entry only.
        // The volume reduction above for moderate severity still applies.
        ctx.rationale.push(
          worst.severity === 'moderate'
            ? `${rationale} — volume reduced`
            : `${rationale} — noted`
        );
      }
    }
  }

  ctx.disruptionSetsRemoved = preCount - ctx.plannedCount;
  if (ctx.disruptionSetsRemoved > 0 && !ctx.skippedMainLift) {
    traceBuilder?.recordVolumeChange({
      source: 'disruption',
      setsBefore: preCount,
      setsAfter: ctx.plannedCount,
      reason: 'Disruption set reduction',
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
