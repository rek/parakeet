import type { WearableReadinessInput } from './wearable-readiness-adjuster';

interface Component {
  weight: number;
  score: number | null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function lerp(value: number, lo: number, hi: number, outLo: number, outHi: number): number {
  if (hi === lo) return outLo;
  const t = clamp((value - lo) / (hi - lo), 0, 1);
  return outLo + t * (outHi - outLo);
}

/**
 * 0–100 composite recovery readiness score.
 * Missing signals have their weight redistributed proportionally across present signals.
 * Returns null only when ALL signals are missing.
 */
export function computeReadinessScore(input: WearableReadinessInput): number | null {
  // HRV: -30% → 0, +15% → 100
  const hrv: Component = {
    weight: 0.40,
    score: input.hrvPctChange !== undefined
      ? lerp(input.hrvPctChange, -30, 15, 0, 100)
      : null,
  };

  // Sleep: 240min → 0, 540min → 100, plus +10 bonus when deepSleepPct >= 20
  const sleepBaseline = input.sleepDurationMin !== undefined
    ? lerp(input.sleepDurationMin, 240, 540, 0, 100)
    : null;
  const deepBonus = input.deepSleepPct !== undefined && input.deepSleepPct >= 20 ? 10 : 0;
  const sleep: Component = {
    weight: 0.30,
    score: sleepBaseline === null ? null : clamp(sleepBaseline + deepBonus, 0, 100),
  };

  // RHR: +20% → 0, -10% → 100
  const rhr: Component = {
    weight: 0.20,
    score: input.restingHrPctChange !== undefined
      ? lerp(input.restingHrPctChange, 20, -10, 0, 100)
      : null,
  };

  // Load: 3 → 25, 2 → 50, 1 → 75, 0 → 100
  const load: Component = {
    weight: 0.10,
    score: input.nonTrainingLoad !== undefined
      ? clamp(100 - input.nonTrainingLoad * 25, 0, 100)
      : null,
  };

  const present = [hrv, sleep, rhr, load].filter((c) => c.score !== null);
  if (present.length === 0) return null;

  const totalWeight = present.reduce((acc, c) => acc + c.weight, 0);
  const weighted = present.reduce(
    (acc, c) => acc + (c.score as number) * (c.weight / totalWeight),
    0
  );
  return Math.round(clamp(weighted, 0, 100));
}
