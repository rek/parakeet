import type { RecentSessionSummary } from '../jit-session-generator';

// Constants — tune from prod data

export const RPE_OVER_THRESHOLD = 0.75;
export const RPE_UNDER_THRESHOLD = -0.75;
export const RPE_LARGE_GAP = 1.25;

export const SMALL_OVER_MULTIPLIER = 0.975;
export const LARGE_OVER_MULTIPLIER = 0.95;
export const SMALL_UNDER_MULTIPLIER = 1.025;
export const LARGE_UNDER_MULTIPLIER = 1.05;

/** Compute average RPE deviation (actual − target) over last 2 sessions with a real RPE value.
 *  Returns null when there are fewer than 2 qualifying logs. */
export function computeAvgRpeDev(
  recentLogs: RecentSessionSummary[]
): number | null {
  const history = recentLogs
    .filter(
      (l): l is RecentSessionSummary & { actual_rpe: number } =>
        l.actual_rpe !== null
    )
    .slice(0, 2);

  if (history.length < 2) return null;

  return (
    history.reduce((s, l) => s + (l.actual_rpe - l.target_rpe), 0) /
    history.length
  );
}
