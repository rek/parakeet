import type {
  AuxExerciseTrace,
  PrescriptionTrace,
  RestTrace,
  VolumeTrace,
  WeightDerivation,
} from '@parakeet/training-engine';
import { capitalize, formatExerciseName } from '@shared/utils/string';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TraceLine {
  text: string;
  subtitle?: string;
}

export interface FormattedAuxSection {
  name: string;
  exerciseId: string;
  lines: TraceLine[];
}

/** App-owned, engine-free representation of a prescription trace for UI display. */
export interface FormattedTrace {
  strategyLabel: string;
  contextLabel: string;
  basePrescription: string | null;
  rationale: string[];
  warnings: string[];
  weightLines: TraceLine[] | null;
  volumeLines: TraceLine[];
  auxSections: FormattedAuxSection[];
  restLines: TraceLine[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

// ── Weight derivation ─────────────────────────────────────────────────────────

export function formatWeightDerivation({
  derivation,
}: {
  derivation: WeightDerivation;
}): TraceLine[] {
  const lines: TraceLine[] = [];

  const pctDisplay = (derivation.blockPct * 100).toFixed(1);

  lines.push({
    text: `1RM: ${derivation.oneRmKg} kg`,
    subtitle:
      derivation.oneRmSource === 'working'
        ? `Computed from recent sessions (stored: ${derivation.storedOneRmKg ?? '?'} kg)`
        : 'Your one-rep max from lifter maxes',
  });

  lines.push({
    text: `× ${pctDisplay}% = ${derivation.baseWeightKg} kg`,
    subtitle: 'Block intensity — percentage of 1RM for this training block',
  });

  for (const mod of derivation.modifiers) {
    lines.push({
      text: `× ${mod.multiplier}`,
      subtitle: mod.reason,
    });
  }

  lines.push({
    text: `= ${derivation.finalWeightKg} kg`,
    subtitle: 'Final prescribed weight after all modifiers',
  });

  return lines;
}

// ── Volume changes ────────────────────────────────────────────────────────────

const VOLUME_SUBTITLES: Record<VolumeTrace['source'], string> = {
  volume_calibration: 'Adapted based on RPE trends, capacity, and readiness',
  rpe_history: 'Adjusted based on recent session difficulty ratings',
  readiness: 'Adjusted for sleep quality and energy level',
  cycle_phase: 'Adjusted for menstrual cycle phase',
  soreness: 'Reduced due to muscle soreness',
  disruption: 'Reduced due to active training disruption',
  mrv_cap: 'Capped at maximum recoverable volume for this muscle',
};

const VOLUME_SOURCE_LABELS: Record<VolumeTrace['source'], string> = {
  volume_calibration: 'Volume calibration',
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
}): TraceLine[] {
  return changes.map((change) => {
    const label = VOLUME_SOURCE_LABELS[change.source] ?? change.source;
    return {
      text: `${label}: ${change.setsBefore} → ${change.setsAfter} sets`,
      subtitle: VOLUME_SUBTITLES[change.source] ?? change.reason,
    };
  });
}

// ── Auxiliary exercise trace ──────────────────────────────────────────────────

const SCALING_SUBTITLES: Record<string, string> = {
  linear: 'Weight scales linearly with primary lift 1RM',
  sqrt: 'Weight scales with square root — for lighter isolation exercises',
};

export function formatAuxTrace({
  aux,
}: {
  aux: AuxExerciseTrace;
}): TraceLine[] {
  const lines: TraceLine[] = [];

  lines.push({ text: aux.selectionReason });

  if (aux.skipped) {
    lines.push({
      text: `Skipped${aux.skipReason ? `: ${aux.skipReason}` : ''}`,
    });
    return lines;
  }

  lines.push({
    text: `${aux.sets} × ${aux.reps} reps`,
    subtitle: `Rep source: ${aux.repSource}`,
  });

  if (aux.weightTrace) {
    const wt = aux.weightTrace;
    lines.push({
      text: `${wt.finalWeightKg} kg (${wt.oneRmKg} × ${wt.catalogPct.toFixed(3)})`,
      subtitle: `Catalog percentage of 1RM · ${SCALING_SUBTITLES[wt.scalingMethod] ?? wt.scalingMethod}`,
    });
    if (wt.sorenessMultiplier !== 1) {
      lines.push({
        text: `× ${wt.sorenessMultiplier} soreness`,
        subtitle: 'Weight reduced due to muscle soreness',
      });
    }
  }

  return lines;
}

// ── Rest trace ────────────────────────────────────────────────────────────────

export function formatRestTrace({ rest }: { rest: RestTrace }): TraceLine[] {
  const lines: TraceLine[] = [];
  const { mainLift } = rest;

  lines.push({
    text: `Formula base: ${fmtSeconds(mainLift.formulaBaseSeconds)}`,
    subtitle: 'Default rest period for this intensity type',
  });

  if (mainLift.userOverrideSeconds !== null) {
    lines.push({
      text: `User override: ${fmtSeconds(mainLift.userOverrideSeconds)}`,
      subtitle: 'Your custom rest setting',
    });
  }

  if (mainLift.llmDeltaSeconds !== null) {
    const sign = mainLift.llmDeltaSeconds >= 0 ? '+' : '';
    lines.push({
      text: `AI delta: ${sign}${mainLift.llmDeltaSeconds}s`,
      subtitle: 'AI-suggested adjustment based on session context',
    });
  }

  lines.push({
    text: `Final: ${fmtSeconds(mainLift.finalSeconds)}`,
    subtitle: 'Prescribed rest between working sets',
  });

  if (rest.auxiliarySeconds !== mainLift.finalSeconds) {
    lines.push({
      text: `Auxiliary: ${fmtSeconds(rest.auxiliarySeconds)}`,
      subtitle: 'Rest between auxiliary exercise sets',
    });
  }

  return lines;
}

// ── Top-level formatter ──────────────────────────────────────────────────────

const STRATEGY_LABELS: Record<string, string> = {
  formula: 'Formula',
  llm: 'LLM',
  hybrid: 'Hybrid',
  formula_fallback: 'Fallback',
};

function formatBasePrescription(trace: PrescriptionTrace): string | null {
  const bc = trace.baseConfig;
  if (!bc || trace.mainLift.isSkipped || trace.mainLift.isRecoveryMode) {
    return null;
  }
  const repsText =
    bc.repsMax != null ? `${bc.reps}–${bc.repsMax} reps` : `${bc.reps} reps`;
  const pct = (bc.pct * 100).toFixed(0);
  return `${bc.sets} sets × ${repsText} @ ${pct}% 1RM`;
}

export function formatPrescriptionTrace(
  trace: PrescriptionTrace
): FormattedTrace {
  return {
    strategyLabel: STRATEGY_LABELS[trace.strategy] ?? trace.strategy,
    contextLabel: `${capitalize(trace.primaryLift)} · ${capitalize(trace.intensityType)} · Block ${trace.blockNumber}`,
    basePrescription: formatBasePrescription(trace),
    rationale: trace.rationale,
    warnings: trace.warnings,
    weightLines: trace.mainLift.weightDerivation
      ? formatWeightDerivation({ derivation: trace.mainLift.weightDerivation })
      : null,
    volumeLines: formatVolumeChanges({ changes: trace.mainLift.volumeChanges }),
    auxSections: trace.auxiliaries.map((aux) => ({
      name: formatExerciseName(aux.exercise),
      exerciseId: aux.exercise,
      lines: formatAuxTrace({ aux }),
    })),
    restLines: formatRestTrace({ rest: trace.rest }),
  };
}
