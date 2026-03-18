import type {
  AuxExerciseTrace,
  RestTrace,
  VolumeTrace,
  WeightDerivation,
} from '@parakeet/training-engine';

// ── Weight derivation ─────────────────────────────────────────────────────────

export function formatWeightDerivation({
  derivation,
}: {
  derivation: WeightDerivation;
}): string[] {
  const lines: string[] = [];

  const pctDisplay = (derivation.blockPct * 100).toFixed(1);
  lines.push(`1RM: ${derivation.oneRmKg} kg`);
  lines.push(`× ${pctDisplay}% = ${derivation.baseWeightKg} kg`);

  for (const mod of derivation.modifiers) {
    lines.push(`× ${mod.multiplier} (${mod.reason})`);
  }

  lines.push(`= ${derivation.finalWeightKg} kg`);

  return lines;
}

// ── Volume changes ────────────────────────────────────────────────────────────

const VOLUME_SOURCE_LABELS: Record<VolumeTrace['source'], string> = {
  rpe_history: 'RPE history',
  readiness: 'Readiness',
  cycle_phase: 'Cycle phase',
  soreness: 'Soreness',
  disruption: 'Disruption',
  mrv_cap: 'MRV cap',
};

export function formatVolumeChanges({
  changes,
}: {
  changes: VolumeTrace[];
}): string[] {
  return changes.map((change) => {
    const label = VOLUME_SOURCE_LABELS[change.source] ?? change.source;
    const direction = change.setsAfter < change.setsBefore ? 'reduced' : 'increased';
    return `${label}: ${change.setsBefore} → ${change.setsAfter} sets (${change.reason} — ${direction})`;
  });
}

// ── Auxiliary exercise trace ──────────────────────────────────────────────────

export function formatAuxTrace({ aux }: { aux: AuxExerciseTrace }): string[] {
  const lines: string[] = [];

  lines.push(aux.selectionReason);

  if (aux.skipped) {
    lines.push(`Skipped${aux.skipReason ? `: ${aux.skipReason}` : ''}`);
    return lines;
  }

  lines.push(`${aux.sets} × ${aux.reps} reps (${aux.repSource})`);

  if (aux.weightTrace) {
    const wt = aux.weightTrace;
    const methodLabel = wt.scalingMethod === 'sqrt' ? 'sqrt' : 'linear';
    lines.push(
      `Weight: ${wt.finalWeightKg} kg (${methodLabel}: ${wt.oneRmKg} × ${wt.catalogPct.toFixed(3)})`
    );
    if (wt.sorenessMultiplier !== 1) {
      lines.push(`Soreness modifier: × ${wt.sorenessMultiplier}`);
    }
  }

  return lines;
}

// ── Rest trace ────────────────────────────────────────────────────────────────

export function formatRestTrace({ rest }: { rest: RestTrace }): string[] {
  const lines: string[] = [];
  const { mainLift } = rest;

  lines.push(`Formula base: ${mainLift.formulaBaseSeconds}s`);

  if (mainLift.userOverrideSeconds !== null) {
    lines.push(`User override: ${mainLift.userOverrideSeconds}s`);
  }

  if (mainLift.llmDeltaSeconds !== null) {
    const sign = mainLift.llmDeltaSeconds >= 0 ? '+' : '';
    lines.push(`LLM delta: ${sign}${mainLift.llmDeltaSeconds}s`);
  }

  lines.push(`Final: ${mainLift.finalSeconds}s`);

  if (rest.auxiliarySeconds !== mainLift.finalSeconds) {
    lines.push(`Auxiliary: ${rest.auxiliarySeconds}s`);
  }

  return lines;
}
