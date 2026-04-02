import type { RepAnalysis, VideoAnalysisResult } from '@parakeet/shared-types';

/** Minimum videos required to establish a meaningful baseline. */
export const MIN_VIDEOS_FOR_BASELINE = 5;

export interface PersonalBaseline {
  videoCount: number;
  avgBarDriftCm: number;
  avgForwardLeanDeg: number;
  avgRomCm: number;
  avgDepthCm: number | null;
  avgKneeAngleDeg: number | null;
  avgHipAngleAtLockoutDeg: number | null;
  /** Standard deviations — used to determine if current session is an outlier. */
  sdBarDriftCm: number;
  sdForwardLeanDeg: number;
  sdRomCm: number;
}

export interface BaselineDeviation {
  metric: string;
  label: string;
  currentValue: number;
  baselineValue: number;
  /** How many standard deviations from the baseline mean. */
  zScore: number;
  direction: 'better' | 'worse' | 'neutral';
}

/**
 * Compute personal baseline from historical video analyses.
 *
 * Aggregates per-rep metrics across all historical analyses into means
 * and standard deviations. Returns null if fewer than MIN_VIDEOS_FOR_BASELINE
 * analyses are available — insufficient data for stable norms.
 */
export function computePersonalBaseline({
  analyses,
}: {
  analyses: VideoAnalysisResult[];
}) {
  const withReps = analyses.filter((a) => a.reps.length > 0);
  if (withReps.length < MIN_VIDEOS_FOR_BASELINE) return null;

  const allReps = withReps.flatMap((a) => a.reps);

  const drifts = allReps.map((r) => r.barDriftCm).filter(defined);
  const leans = allReps.map((r) => r.forwardLeanDeg).filter(defined);
  const roms = allReps.map((r) => r.romCm).filter(defined);
  const depths = allReps.map((r) => r.maxDepthCm).filter(defined);
  const knees = allReps.map((r) => r.kneeAngleDeg).filter(defined);
  const hips = allReps.map((r) => r.hipAngleAtLockoutDeg).filter(defined);

  return {
    videoCount: withReps.length,
    avgBarDriftCm: mean(drifts),
    avgForwardLeanDeg: mean(leans),
    avgRomCm: mean(roms),
    avgDepthCm: depths.length > 0 ? mean(depths) : null,
    avgKneeAngleDeg: knees.length > 0 ? mean(knees) : null,
    avgHipAngleAtLockoutDeg: hips.length > 0 ? mean(hips) : null,
    sdBarDriftCm: sd(drifts),
    sdForwardLeanDeg: sd(leans),
    sdRomCm: sd(roms),
  } satisfies PersonalBaseline;
}

/**
 * Detect deviations between current rep metrics and personal baseline.
 *
 * A deviation is flagged when a metric is >1.5 standard deviations from the
 * baseline mean. Direction indicates whether the deviation is positive
 * (improved form) or negative (degraded form) based on the metric semantics:
 * - Bar drift: lower is better
 * - Forward lean: lower is better (for squat)
 * - ROM: higher is better (more range of motion)
 * - Depth: more negative is better (deeper below parallel)
 */
export function detectBaselineDeviations({
  rep,
  baseline,
  lift,
}: {
  rep: RepAnalysis;
  baseline: PersonalBaseline;
  lift: 'squat' | 'bench' | 'deadlift';
}) {
  const deviations: BaselineDeviation[] = [];
  const Z_THRESHOLD = 1.5;

  // Bar drift — lower is better
  if (rep.barDriftCm != null && baseline.sdBarDriftCm > 0) {
    const z = (rep.barDriftCm - baseline.avgBarDriftCm) / baseline.sdBarDriftCm;
    if (Math.abs(z) >= Z_THRESHOLD) {
      deviations.push({
        metric: 'barDriftCm',
        label: 'Bar drift',
        currentValue: rep.barDriftCm,
        baselineValue: baseline.avgBarDriftCm,
        zScore: z,
        direction: z < 0 ? 'better' : 'worse',
      });
    }
  }

  // Forward lean — lower is better
  if (rep.forwardLeanDeg != null && baseline.sdForwardLeanDeg > 0) {
    const z =
      (rep.forwardLeanDeg - baseline.avgForwardLeanDeg) /
      baseline.sdForwardLeanDeg;
    if (Math.abs(z) >= Z_THRESHOLD) {
      deviations.push({
        metric: 'forwardLeanDeg',
        label: 'Forward lean',
        currentValue: rep.forwardLeanDeg,
        baselineValue: baseline.avgForwardLeanDeg,
        zScore: z,
        direction: z < 0 ? 'better' : 'worse',
      });
    }
  }

  // ROM — higher is better
  if (rep.romCm != null && baseline.sdRomCm > 0) {
    const z = (rep.romCm - baseline.avgRomCm) / baseline.sdRomCm;
    if (Math.abs(z) >= Z_THRESHOLD) {
      deviations.push({
        metric: 'romCm',
        label: 'Range of motion',
        currentValue: rep.romCm,
        baselineValue: baseline.avgRomCm,
        zScore: z,
        direction: z > 0 ? 'better' : 'worse',
      });
    }
  }

  // Depth — more positive is better (deeper below parallel, squat only)
  // depth-detector convention: positive depthCm = below parallel
  if (
    lift === 'squat' &&
    rep.maxDepthCm != null &&
    baseline.avgDepthCm != null
  ) {
    const diff = rep.maxDepthCm - baseline.avgDepthCm;
    // Positive diff = deeper than usual = better
    if (Math.abs(diff) > 2) {
      deviations.push({
        metric: 'maxDepthCm',
        label: 'Depth',
        currentValue: rep.maxDepthCm,
        baselineValue: baseline.avgDepthCm,
        zScore: diff,
        direction: diff > 0 ? 'better' : 'worse',
      });
    }
  }

  return deviations;
}

function defined<T>(v: T | null | undefined): v is T {
  return v != null;
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function sd(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
