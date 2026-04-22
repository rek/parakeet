// @spec docs/features/lipedema-tracking/spec-data-layer.md
import type { LipedemaMeasurement } from '../model/types';

export interface TrendPoint {
  date: string;
  value: number;
}

export interface LimbTrend {
  sideL: TrendPoint[];
  sideR: TrendPoint[];
}

/**
 * Extract per-limb L+R circumference series from the full measurements
 * list. Missing values are skipped (the point isn't emitted) rather
 * than imputed — the UI shows gaps honestly.
 */
export function limbTrend(
  rows: LipedemaMeasurement[],
  pick: (m: LipedemaMeasurement) => { l: number | null; r: number | null },
): LimbTrend {
  const sorted = [...rows].sort((a, b) =>
    a.recordedDate.localeCompare(b.recordedDate),
  );
  const sideL: TrendPoint[] = [];
  const sideR: TrendPoint[] = [];
  for (const r of sorted) {
    const { l, r: right } = pick(r);
    if (l != null) sideL.push({ date: r.recordedDate, value: l });
    if (right != null) sideR.push({ date: r.recordedDate, value: right });
  }
  return { sideL, sideR };
}

/**
 * Simple delta: latest-minus-baseline. Null when fewer than 2 points.
 * Positive delta = growth (concerning for lipedema).
 */
export function latestDelta(series: TrendPoint[]): number | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  return last.value - first.value;
}
