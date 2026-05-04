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
 * list. Missing values are skipped (no imputation) — the UI shows gaps
 * honestly. Sort is lexicographic on YYYY-MM-DD which matches chrono
 * order; cheap and correct for any ISO date format.
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
 * Last value minus first value across the whole series. Positive =
 * growth (concerning for lipedema). Null when fewer than 2 points.
 */
export function seriesDrift(series: TrendPoint[]): number | null {
  if (series.length < 2) return null;
  return series[series.length - 1].value - series[0].value;
}

/**
 * Last value minus the value before it. Useful for "change since last
 * entry" badges. Null when fewer than 2 points.
 */
export function adjacentDelta(series: TrendPoint[]): number | null {
  if (series.length < 2) return null;
  return series[series.length - 1].value - series[series.length - 2].value;
}

/**
 * Most recent measurement for a given limb side, scanning back through
 * sorted-desc rows for the first non-null value. Null if none found.
 * `excludeDate` lets the form ignore the in-progress entry so the
 * "previous" delta is genuinely the prior session.
 */
export function priorValue(
  rows: LipedemaMeasurement[],
  pick: (m: LipedemaMeasurement) => number | null,
  excludeDate?: string,
): { date: string; value: number } | null {
  const sorted = [...rows].sort((a, b) =>
    b.recordedDate.localeCompare(a.recordedDate),
  );
  for (const r of sorted) {
    if (excludeDate && r.recordedDate === excludeDate) continue;
    const v = pick(r);
    if (v != null) return { date: r.recordedDate, value: v };
  }
  return null;
}
