import type {
  AuxExerciseTrace,
  RestTrace,
  VolumeTrace,
  WeightDerivation,
} from '@parakeet/training-engine';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

function fmtPct(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`;
}

const REP_SOURCE_LABELS: Record<string, string> = {
  'exercise catalog': 'catalog default',
  'volume top-up default': 'top-up default',
};

function readableRepSource(raw: string): string {
  // "block1.heavy config" → "block 1 heavy"
  const blockMatch = raw.match(/^block(\d+)\.(\w+)\s+config$/);
  if (blockMatch) return `block ${blockMatch[1]} ${blockMatch[2]}`;
  return REP_SOURCE_LABELS[raw] ?? raw;
}

// ── Weight derivation ─────────────────────────────────────────────────────────

export function formatWeightDerivation({
  derivation,
}: {
  derivation: WeightDerivation;
}): string[] {
  const lines: string[] = [];

  const sourceLabel = derivation.oneRmSource === 'working'
    ? ' (working)'
    : derivation.oneRmSource === 'stored'
      ? ' (stored)'
      : '';
  lines.push(`1RM: ${derivation.oneRmKg} kg${sourceLabel}`);

  if (derivation.storedOneRmKg != null && derivation.oneRmSource === 'working') {
    lines.push(`  stored 1RM: ${derivation.storedOneRmKg} kg`);
  }

  lines.push(`Block target: ${fmtPct(derivation.blockPct)} → ${derivation.baseWeightKg} kg`);

  for (const mod of derivation.modifiers) {
    const pctChange = ((mod.multiplier - 1) * 100).toFixed(1);
    const sign = mod.multiplier >= 1 ? '+' : '';
    lines.push(`${mod.reason}: ${sign}${pctChange}%`);
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
    const delta = change.setsAfter - change.setsBefore;
    const sign = delta >= 0 ? '+' : '';
    return `${label}: ${change.setsBefore} → ${change.setsAfter} sets (${sign}${delta})`;
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

  lines.push(`${aux.sets} × ${aux.reps} reps (${readableRepSource(aux.repSource)})`);

  if (aux.weightTrace) {
    const wt = aux.weightTrace;
    const scalingLabel = wt.scalingMethod === 'sqrt' ? 'sqrt scaling' : 'linear scaling';
    lines.push(`${wt.finalWeightKg} kg (${fmtPct(wt.catalogPct)} of 1RM, ${scalingLabel})`);
    if (wt.sorenessMultiplier !== 1) {
      const pctChange = ((wt.sorenessMultiplier - 1) * 100).toFixed(0);
      lines.push(`Soreness: ${pctChange}% weight`);
    }
  }

  return lines;
}

// ── Rest trace ────────────────────────────────────────────────────────────────

export function formatRestTrace({ rest }: { rest: RestTrace }): string[] {
  const lines: string[] = [];
  const { mainLift } = rest;

  lines.push(`Base: ${fmtSeconds(mainLift.formulaBaseSeconds)}`);

  if (mainLift.userOverrideSeconds !== null) {
    lines.push(`Your override: ${fmtSeconds(mainLift.userOverrideSeconds)}`);
  }

  if (mainLift.llmDeltaSeconds !== null) {
    const sign = mainLift.llmDeltaSeconds >= 0 ? '+' : '';
    lines.push(`AI adjustment: ${sign}${mainLift.llmDeltaSeconds}s`);
  }

  lines.push(`Final: ${fmtSeconds(mainLift.finalSeconds)}`);

  if (rest.auxiliarySeconds !== mainLift.finalSeconds) {
    lines.push(`Auxiliary: ${fmtSeconds(rest.auxiliarySeconds)}`);
  }

  return lines;
}
