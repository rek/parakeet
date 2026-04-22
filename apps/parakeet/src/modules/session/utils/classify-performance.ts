// @spec docs/features/session/spec-performance.md
// Completion-percentage classification for session_logs.performance_vs_plan.
// Source of truth — kept in sync with docs/domain/periodization.md "Completion
// Classification Thresholds". Update both when tuning.

export type PerformanceVsPlan = 'over' | 'at' | 'under' | 'incomplete';

export const COMPLETION_PCT_INCOMPLETE_BELOW = 50;
export const COMPLETION_PCT_UNDER_BELOW = 90;
export const COMPLETION_RATIO_OVER_ABOVE = 1.1;

export function classifyPerformance(
  completedCount: number,
  plannedCount: number,
  completionPct: number
): PerformanceVsPlan {
  if (completionPct < COMPLETION_PCT_INCOMPLETE_BELOW) return 'incomplete';
  if (completionPct < COMPLETION_PCT_UNDER_BELOW) return 'under';
  if (
    plannedCount > 0
    && completedCount / plannedCount > COMPLETION_RATIO_OVER_ABOVE
  ) {
    return 'over';
  }
  return 'at';
}
