// Computes weight deviations and a working 1RM estimate from recent session data.
// All weights are in kg — grams→kg conversion is the responsibility of the app layer.

import { estimateOneRepMax_Epley } from '../formulas/one-rep-max';
import { roundToNearest } from '../formulas/weight-rounding';

const MIN_RPE = 7;
const MIN_REPS = 1;
const MAX_REPS = 20;
const MAX_CAP_PCT = 1.10;
const MIN_FLOOR_PCT = 0.85;
const MIN_SESSIONS_MEDIUM = 3;
const MIN_SESSIONS_HIGH = 5;

/** Input for a single actual set (already converted to kg by orchestrator) */
export interface ActualSetKg {
  weightKg: number;
  reps: number;
  rpe?: number;
}

export interface WeightDeviationSummary {
  plannedWeightKg: number;
  actualMaxWeightKg: number;      // heaviest completed set (with reps > 0)
  deviationKg: number;            // actual - planned (signed)
  deviationPct: number;           // deviationKg / plannedWeightKg
  estimatedOneRmKg: number | null; // Epley from best qualifying set
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Summarise how actual sets deviated from the planned weight for a single exercise slot.
 * Returns null if inputs are insufficient to compute anything meaningful.
 */
export function computeWeightDeviation({
  plannedWeightKg,
  actualSets,
}: {
  plannedWeightKg: number;
  actualSets: ActualSetKg[];
}): WeightDeviationSummary | null {
  if (plannedWeightKg <= 0 || actualSets.length === 0) return null;

  const validSets = actualSets.filter((s) => s.weightKg > 0 && s.reps > 0);
  if (validSets.length === 0) return null;

  const actualMaxWeightKg = Math.max(...validSets.map((s) => s.weightKg));
  const deviationKg = actualMaxWeightKg - plannedWeightKg;
  const deviationPct = deviationKg / plannedWeightKg;

  // Qualifying sets for 1RM estimation: RPE >= MIN_RPE, reps within Epley's valid range
  const qualifyingSets = validSets.filter(
    (s) =>
      s.rpe !== undefined &&
      s.rpe >= MIN_RPE &&
      s.reps >= MIN_REPS &&
      s.reps <= MAX_REPS
  );

  let estimatedOneRmKg: number | null = null;
  if (qualifyingSets.length > 0) {
    const estimates = qualifyingSets.map((s) => estimateOneRepMax_Epley(s.weightKg, s.reps));
    estimatedOneRmKg = Math.max(...estimates);
  }

  return {
    plannedWeightKg,
    actualMaxWeightKg,
    deviationKg,
    deviationPct,
    estimatedOneRmKg,
  };
}

/**
 * Derive a working 1RM from recent session summaries, bounded by the stored 1RM.
 * Confidence reflects how many qualifying sessions contributed to the estimate.
 */
export function computeWorkingOneRm({
  recentEstimates,
  storedOneRmKg,
}: {
  recentEstimates: Array<{ estimatedOneRmKg: number | null }>;
  storedOneRmKg: number;
}) {
  const qualifying = recentEstimates.filter(
    (s) => s.estimatedOneRmKg !== null && s.estimatedOneRmKg > 0
  );

  if (qualifying.length < MIN_SESSIONS_MEDIUM) {
    return {
      workingOneRmKg: storedOneRmKg,
      confidence: 'low' as const,
      source: 'stored' as const,
    };
  }

  const estimates = qualifying.map((s) => s.estimatedOneRmKg as number);
  const raw = median(estimates);

  const capped = Math.min(raw, storedOneRmKg * MAX_CAP_PCT);
  const floored = Math.max(capped, storedOneRmKg * MIN_FLOOR_PCT);
  const workingOneRmKg = roundToNearest(floored);

  const confidence = qualifying.length >= MIN_SESSIONS_HIGH ? 'high' as const : 'medium' as const;
  const source = workingOneRmKg !== storedOneRmKg ? 'working' as const : 'stored' as const;

  return { workingOneRmKg, confidence, source };
}
