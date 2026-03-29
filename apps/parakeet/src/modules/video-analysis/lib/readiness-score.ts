import type { RepAnalysis } from '@parakeet/shared-types';

import { gradeRep } from './competition-grader';
import type { RepVerdict, CriterionResult } from './competition-grader';
import type { PoseFrame } from './pose-types';
import type { SessionVideo } from '../model/types';

/** Maximum number of recent videos to include in the readiness window. */
const MAX_WINDOW = 5;

/** Maximum age of videos to include (8 weeks in ms). */
const MAX_AGE_MS = 8 * 7 * 24 * 60 * 60 * 1000;

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
 * Compute competition readiness score from recent videos for a lift.
 *
 * Grades every rep in each video against IPF standards, then aggregates
 * into a pass rate with trend detection. Excludes deload sessions and
 * videos older than 8 weeks.
 *
 * Returns null if no eligible videos exist.
 */
export function computeReadinessScore({
  videos,
  frames,
  lift,
  fps,
  now = Date.now(),
}: {
  videos: Array<SessionVideo & { frames?: PoseFrame[] }>;
  frames: Map<string, PoseFrame[]>;
  lift: 'squat' | 'bench' | 'deadlift';
  fps: number;
  now?: number;
}) {
  // Filter: recent, non-deload, has analysis
  const eligible = videos
    .filter((v) => v.analysis && v.analysis.reps.length > 0)
    .filter((v) => now - new Date(v.createdAt).getTime() < MAX_AGE_MS)
    .slice(0, MAX_WINDOW);

  if (eligible.length === 0) return null;

  // Grade every rep in every video
  const allVerdicts: Array<{ verdict: RepVerdict; videoIdx: number }> = [];

  for (let vi = 0; vi < eligible.length; vi++) {
    const video = eligible[vi];
    const videoFrames = frames.get(video.id);
    if (!videoFrames || !video.analysis) continue;

    for (const rep of video.analysis.reps) {
      const verdict = gradeRep({ rep, frames: videoFrames, fps, lift });
      allVerdicts.push({ verdict, videoIdx: vi });
    }
  }

  if (allVerdicts.length === 0) return null;

  const passedReps = allVerdicts.filter((v) => v.verdict.verdict === 'white_light').length;
  const borderlineReps = allVerdicts.filter((v) => v.verdict.verdict === 'borderline').length;
  const failedReps = allVerdicts.filter((v) => v.verdict.verdict === 'red_light').length;
  const totalReps = allVerdicts.length;

  // Trend: compare first half vs second half pass rates
  const mid = Math.floor(allVerdicts.length / 2);
  const firstHalf = allVerdicts.slice(0, mid);
  const secondHalf = allVerdicts.slice(mid);
  const firstPassRate = firstHalf.length > 0
    ? firstHalf.filter((v) => v.verdict.verdict === 'white_light').length / firstHalf.length
    : 0;
  const secondPassRate = secondHalf.length > 0
    ? secondHalf.filter((v) => v.verdict.verdict === 'white_light').length / secondHalf.length
    : 0;

  let trend: ReadinessScore['trend'];
  const delta = secondPassRate - firstPassRate;
  if (delta > 0.1) trend = 'improving';
  else if (delta < -0.1) trend = 'declining';
  else trend = 'stable';

  // Most common failure criterion
  const failureCounts = new Map<string, number>();
  for (const { verdict } of allVerdicts) {
    for (const c of verdict.criteria) {
      if (c.verdict === 'fail') {
        failureCounts.set(c.name, (failureCounts.get(c.name) ?? 0) + 1);
      }
    }
  }
  let mostCommonFailure: string | null = null;
  let maxCount = 0;
  for (const [name, count] of failureCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonFailure = name;
    }
  }

  return {
    passRate: passedReps / totalReps,
    totalReps,
    passedReps,
    borderlineReps,
    failedReps,
    trend,
    mostCommonFailure,
    window: eligible.length,
  } satisfies ReadinessScore;
}

/**
 * Simplified readiness computation that works with pre-graded verdicts.
 * Used when frames aren't available (e.g., from stored analysis with verdicts).
 */
export function computeReadinessFromVerdicts({
  verdicts,
}: {
  verdicts: RepVerdict[];
}) {
  if (verdicts.length === 0) return null;

  const passedReps = verdicts.filter((v) => v.verdict === 'white_light').length;
  const borderlineReps = verdicts.filter((v) => v.verdict === 'borderline').length;
  const failedReps = verdicts.filter((v) => v.verdict === 'red_light').length;
  const totalReps = verdicts.length;

  const mid = Math.floor(verdicts.length / 2);
  const firstPassRate = verdicts.slice(0, mid).filter((v) => v.verdict === 'white_light').length / Math.max(mid, 1);
  const secondPassRate = verdicts.slice(mid).filter((v) => v.verdict === 'white_light').length / Math.max(verdicts.length - mid, 1);
  const delta = secondPassRate - firstPassRate;

  let trend: ReadinessScore['trend'];
  if (delta > 0.1) trend = 'improving';
  else if (delta < -0.1) trend = 'declining';
  else trend = 'stable';

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
    window: 0,
  } satisfies ReadinessScore;
}
