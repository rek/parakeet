import type { CyclePhase } from '@parakeet/training-engine';

import { CYCLE_PHASE_LABELS, CYCLE_PHASES } from '../ui/cycle-phase-styles';

export interface PhaseStats {
  sessionCount: number;
  avgRpe: number | null;
}

export function computePhaseStats(
  sessions: Array<{ cycle_phase: string | null; rpe?: number | null }>
): Record<CyclePhase, PhaseStats> {
  const buckets: Record<
    CyclePhase,
    { rpeSum: number; rpeCount: number; total: number }
  > = {
    menstrual: { rpeSum: 0, rpeCount: 0, total: 0 },
    follicular: { rpeSum: 0, rpeCount: 0, total: 0 },
    ovulatory: { rpeSum: 0, rpeCount: 0, total: 0 },
    luteal: { rpeSum: 0, rpeCount: 0, total: 0 },
    late_luteal: { rpeSum: 0, rpeCount: 0, total: 0 },
  };

  for (const s of sessions) {
    if (!s.cycle_phase || !(s.cycle_phase in buckets)) continue;
    const phase = s.cycle_phase as CyclePhase;
    buckets[phase].total++;
    if (s.rpe != null) {
      buckets[phase].rpeSum += s.rpe;
      buckets[phase].rpeCount++;
    }
  }

  return Object.fromEntries(
    CYCLE_PHASES.map((phase) => {
      const b = buckets[phase];
      return [
        phase,
        {
          sessionCount: b.total,
          avgRpe: b.rpeCount > 0 ? b.rpeSum / b.rpeCount : null,
        },
      ];
    })
  ) as Record<CyclePhase, PhaseStats>;
}

export function generateInsight(
  stats: Record<CyclePhase, PhaseStats>
): string | null {
  const withRpe = CYCLE_PHASES.filter((p) => stats[p].avgRpe != null);
  if (withRpe.length < 2) return null;

  let maxPhase = withRpe[0];
  let minPhase = withRpe[0];
  for (const p of withRpe) {
    if (stats[p].avgRpe! > stats[maxPhase].avgRpe!) maxPhase = p;
    if (stats[p].avgRpe! < stats[minPhase].avgRpe!) minPhase = p;
  }

  if (maxPhase === minPhase) return null;

  return `Your average RPE in the ${CYCLE_PHASE_LABELS[maxPhase].toLowerCase()} phase (${stats[maxPhase].avgRpe!.toFixed(1)}) is higher than in the ${CYCLE_PHASE_LABELS[minPhase].toLowerCase()} phase (${stats[minPhase].avgRpe!.toFixed(1)}). This is a common pattern.`;
}
