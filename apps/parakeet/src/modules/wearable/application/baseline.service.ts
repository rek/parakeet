import { fetchReadingsForBaseline } from '../data/biometric.repository';
import type { BiometricType } from '@parakeet/shared-types';

const MIN_DAYS_FOR_BASELINE = 5;

/**
 * Returns the mean of the best reading per day for the last `days` days.
 * Returns null if fewer than MIN_DAYS_FOR_BASELINE distinct days have readings.
 * 5-day warmup gate: below threshold → null → engine falls back to subjective adjuster.
 */
export async function computeBaseline(
  userId: string,
  type: BiometricType,
  days: number
): Promise<number | null> {
  const readings = await fetchReadingsForBaseline(userId, type, days);
  if (readings.length === 0) return null;

  const byDay = new Map<string, number[]>();
  for (const r of readings) {
    const day = r.recorded_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(r.value);
  }
  if (byDay.size < MIN_DAYS_FOR_BASELINE) return null;

  const perDayBest: number[] = [];
  for (const values of byDay.values()) {
    if (type === 'resting_hr') perDayBest.push(Math.min(...values));
    else if (type === 'hrv_rmssd') perDayBest.push(Math.max(...values));
    else perDayBest.push(values.reduce((a, b) => a + b, 0) / values.length);
  }
  return perDayBest.reduce((a, b) => a + b, 0) / perDayBest.length;
}

export function computePctChange(
  currentValue: number,
  baseline: number | null
): number | null {
  if (baseline === null || baseline === 0) return null;
  return ((currentValue - baseline) / baseline) * 100;
}
