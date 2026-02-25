import { IntensityType, Lift } from '@parakeet/shared-types'
import {
  AdjustmentThresholds,
  PerformanceSuggestion,
  SessionLogSummary,
} from '../types'

export const DEFAULT_THRESHOLDS_MALE: AdjustmentThresholds = {
  rpe_deviation_threshold: 1.0,
  consecutive_sessions_required: 2,
  incomplete_session_threshold: 80,
  max_suggestions_per_lift: 1,
}

export const DEFAULT_THRESHOLDS_FEMALE: AdjustmentThresholds = {
  rpe_deviation_threshold: 1.5,
  consecutive_sessions_required: 3,
  incomplete_session_threshold: 80,
  max_suggestions_per_lift: 1,
}

export function getDefaultThresholds(biologicalSex?: 'female' | 'male'): AdjustmentThresholds {
  return biologicalSex === 'female' ? DEFAULT_THRESHOLDS_FEMALE : DEFAULT_THRESHOLDS_MALE
}

export function suggestProgramAdjustments(
  recentLogs: SessionLogSummary[],
  thresholds: AdjustmentThresholds = DEFAULT_THRESHOLDS_MALE,
): PerformanceSuggestion[] {
  const suggestions: PerformanceSuggestion[] = []
  const rpeSuggestionsPerLift: Partial<Record<Lift, number>> = {}

  // Rule 3: flag incomplete sessions (individual, no grouping needed)
  for (const log of recentLogs) {
    if (
      log.completion_pct !== null &&
      log.completion_pct < thresholds.incomplete_session_threshold
    ) {
      suggestions.push({
        type: 'flag_for_review',
        affected_lift: log.lift,
        affected_block: null,
        pct_adjustment: null,
        rationale: `Session incomplete at ${log.completion_pct}% completion`,
        session_id: log.session_id,
        completion_pct: log.completion_pct,
      })
    }
  }

  // Group by lift + intensity_type (order preserved = most-recent-first from caller)
  const groups = new Map<string, SessionLogSummary[]>()
  for (const log of recentLogs) {
    const key = `${log.lift}:${log.intensity_type}`
    const group = groups.get(key) ?? []
    groups.set(key, group)
    group.push(log)
  }

  // Rules 1 & 2: RPE patterns per group
  for (const [key, logs] of groups) {
    const [lift, intensityType] = key.split(':') as [Lift, IntensityType]
    const liftCount = rpeSuggestionsPerLift[lift] ?? 0
    if (liftCount >= thresholds.max_suggestions_per_lift) continue

    // Narrow type so actual_rpe is known non-null in subsequent callbacks
    const withRpe = logs.filter(
      (l): l is SessionLogSummary & { actual_rpe: number } => l.actual_rpe !== null,
    )
    if (withRpe.length < thresholds.consecutive_sessions_required) continue

    const recent = withRpe.slice(0, thresholds.consecutive_sessions_required)

    const allHigh = recent.every(
      (l) => l.actual_rpe - l.target_rpe > thresholds.rpe_deviation_threshold,
    )
    const allLow = recent.every(
      (l) => l.target_rpe - l.actual_rpe > thresholds.rpe_deviation_threshold,
    )

    if (allHigh) {
      const avgDeviation =
        recent.reduce((sum, l) => sum + (l.actual_rpe - l.target_rpe), 0) /
        recent.length
      suggestions.push({
        type: 'reduce_pct',
        affected_lift: lift,
        affected_block: intensityType,
        pct_adjustment: -0.025,
        rationale: `${lift} ${intensityType} RPE has averaged ${avgDeviation.toFixed(1)} above target over last ${recent.length} sessions`,
      })
      rpeSuggestionsPerLift[lift] = liftCount + 1
    } else if (allLow) {
      suggestions.push({
        type: 'increase_pct',
        affected_lift: lift,
        affected_block: intensityType,
        pct_adjustment: 0.025,
        rationale: 'Loading appears below intended stimulus',
      })
      rpeSuggestionsPerLift[lift] = liftCount + 1
    }
  }

  return suggestions
}
