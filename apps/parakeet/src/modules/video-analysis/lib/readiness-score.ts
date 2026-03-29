import type { RepVerdict } from './competition-grader';

export interface ReadinessScore {
  passRate: number;
  totalReps: number;
  passedReps: number;
  borderlineReps: number;
  failedReps: number;
  trend: 'improving' | 'stable' | 'declining';
  mostCommonFailure: string | null;
  window: number;
}

/**
 * Compute competition readiness from pre-graded rep verdicts.
 *
 * Aggregates pass/fail/borderline counts, detects trend (first half vs
 * second half of verdicts), and identifies the most common failure criterion.
 *
 * Returns null if no verdicts provided.
 */
export function computeReadinessFromVerdicts({
  verdicts,
  window = 0,
}: {
  verdicts: RepVerdict[];
  window?: number;
}) {
  if (verdicts.length === 0) return null;

  const passedReps = verdicts.filter((v) => v.verdict === 'white_light').length;
  const borderlineReps = verdicts.filter((v) => v.verdict === 'borderline').length;
  const failedReps = verdicts.filter((v) => v.verdict === 'red_light').length;
  const totalReps = verdicts.length;

  // Trend: compare first half vs second half pass rates
  const mid = Math.floor(verdicts.length / 2);
  const firstPassRate = verdicts.slice(0, mid).filter((v) => v.verdict === 'white_light').length / Math.max(mid, 1);
  const secondPassRate = verdicts.slice(mid).filter((v) => v.verdict === 'white_light').length / Math.max(verdicts.length - mid, 1);
  const delta = secondPassRate - firstPassRate;

  let trend: ReadinessScore['trend'];
  if (delta > 0.1) trend = 'improving';
  else if (delta < -0.1) trend = 'declining';
  else trend = 'stable';

  // Most common failure criterion
  const failureCounts = new Map<string, number>();
  for (const v of verdicts) {
    for (const c of v.criteria) {
      if (c.verdict === 'fail') {
        failureCounts.set(c.name, (failureCounts.get(c.name) ?? 0) + 1);
      }
    }
  }
  let mostCommonFailure: string | null = null;
  let maxCount = 0;
  for (const [name, count] of failureCounts) {
    if (count > maxCount) { maxCount = count; mostCommonFailure = name; }
  }

  return {
    passRate: passedReps / totalReps,
    totalReps,
    passedReps,
    borderlineReps,
    failedReps,
    trend,
    mostCommonFailure,
    window,
  } satisfies ReadinessScore;
}
