import { estimateOneRepMax_Epley, gramsToKg } from '@parakeet/training-engine';

export interface LiftHistoryEntry {
  completedAt: string;
  estimatedOneRmKg: number;
  sessionRpe: number | null;
  completionPct: number | null;
}

export interface LiftHistory {
  entries: LiftHistoryEntry[];
  trend: 'improving' | 'stable' | 'declining' | null;
}

export interface RawHistoryRow {
  completed_at: string;
  actual_sets: unknown;
  session_rpe: number | null;
  completion_pct: number | null;
  sessions: unknown;
}

export function processRecentHistory(rows: RawHistoryRow[]): LiftHistory {
  const entries: LiftHistoryEntry[] = rows.map((row) => ({
    completedAt: row.completed_at,
    estimatedOneRmKg: estimateHeaviestOneRm(row.actual_sets),
    sessionRpe: row.session_rpe ?? null,
    completionPct: row.completion_pct ?? null,
  }));

  const trend = computeTrend(entries.map((e) => e.estimatedOneRmKg));

  return { entries, trend };
}

function estimateHeaviestOneRm(actualSets: unknown): number {
  if (!Array.isArray(actualSets) || actualSets.length === 0) return 0;
  let best = 0;
  for (const s of actualSets as {
    weight_grams?: number;
    reps_completed?: number;
  }[]) {
    if (!s.weight_grams || !s.reps_completed || s.reps_completed <= 0) continue;
    const est = estimateOneRepMax_Epley(
      gramsToKg(s.weight_grams),
      s.reps_completed
    );
    if (est > best) best = est;
  }
  return best;
}

function computeTrend(oneRmSeries: number[]): LiftHistory['trend'] {
  if (oneRmSeries.length < 2) return null;
  const recent = avg(oneRmSeries.slice(0, Math.ceil(oneRmSeries.length / 2)));
  const older = avg(oneRmSeries.slice(Math.floor(oneRmSeries.length / 2)));
  const delta = recent - older;
  if (delta > 2.5) return 'improving';
  if (delta < -2.5) return 'declining';
  return 'stable';
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
