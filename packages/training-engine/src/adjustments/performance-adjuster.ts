import {
  AdjustmentThresholds,
  PerformanceSuggestion,
  SessionLogSummary,
} from '../types';

export const DEFAULT_THRESHOLDS_MALE: AdjustmentThresholds = {
  rpe_deviation_threshold: 1.0,
  consecutive_sessions_required: 2,
  incomplete_session_threshold: 80,
  max_suggestions_per_lift: 1,
};

export const DEFAULT_THRESHOLDS_FEMALE: AdjustmentThresholds = {
  rpe_deviation_threshold: 1.5,
  consecutive_sessions_required: 3,
  incomplete_session_threshold: 80,
  max_suggestions_per_lift: 1,
};

export function getDefaultThresholds(sex?: string): AdjustmentThresholds {
  return sex === 'female' ? DEFAULT_THRESHOLDS_FEMALE : DEFAULT_THRESHOLDS_MALE;
}

export function suggestProgramAdjustments(
  logs: SessionLogSummary[],
  thresholds: AdjustmentThresholds = DEFAULT_THRESHOLDS_MALE
): PerformanceSuggestion[] {
  const suggestions: PerformanceSuggestion[] = [];

  // Rule 3: flag incomplete sessions
  for (const log of logs) {
    if (
      log.completion_pct !== null &&
      log.completion_pct < thresholds.incomplete_session_threshold
    ) {
      suggestions.push({
        type: 'flag_for_review',
        affected_lift: log.lift,
        affected_block: log.intensity_type,
        pct_adjustment: null,
        rationale: `Session ${log.session_id} completed only ${log.completion_pct}% of planned sets.`,
        session_id: log.session_id,
        completion_pct: log.completion_pct,
      });
    }
  }

  // Group logs by (lift, intensity_type) preserving insertion order
  const groups = new Map<string, SessionLogSummary[]>();
  for (const log of logs) {
    const key = `${log.lift}::${log.intensity_type}`;
    const group = groups.get(key);
    if (group) {
      group.push(log);
    } else {
      groups.set(key, [log]);
    }
  }

  // Track RPE-based suggestion count per lift for max_suggestions_per_lift cap
  const rpeSuggestionsPerLift = new Map<string, number>();

  for (const [key, group] of groups) {
    const [lift, intensityType] = key.split('::') as [
      SessionLogSummary['lift'],
      SessionLogSummary['intensity_type'],
    ];

    const currentCount = rpeSuggestionsPerLift.get(lift) ?? 0;
    if (currentCount >= thresholds.max_suggestions_per_lift) continue;

    // Rule 1: consecutive high RPE → reduce_pct
    let highRun = 0;
    let lastHighDeviation = 0;
    let emittedHigh = false;
    for (const log of group) {
      if (log.actual_rpe === null) {
        highRun = 0;
        continue;
      }
      const deviation = log.actual_rpe - log.target_rpe;
      if (deviation > thresholds.rpe_deviation_threshold) {
        highRun++;
        lastHighDeviation = deviation;
      } else {
        highRun = 0;
      }
      if (highRun >= thresholds.consecutive_sessions_required) {
        const roundedDev = Math.round(lastHighDeviation * 10) / 10;
        suggestions.push({
          type: 'reduce_pct',
          affected_lift: lift,
          affected_block: intensityType,
          pct_adjustment: -0.025,
          rationale: `${lift} ${intensityType} RPE consistently exceeded target by ${roundedDev} — reduce percentage.`,
        });
        rpeSuggestionsPerLift.set(lift, (rpeSuggestionsPerLift.get(lift) ?? 0) + 1);
        emittedHigh = true;
        break;
      }
    }

    if (emittedHigh) continue;
    if ((rpeSuggestionsPerLift.get(lift) ?? 0) >= thresholds.max_suggestions_per_lift) continue;

    // Rule 2: consecutive low RPE → increase_pct
    let lowRun = 0;
    let lastLowDeviation = 0;
    for (const log of group) {
      if (log.actual_rpe === null) {
        lowRun = 0;
        continue;
      }
      const deviation = log.target_rpe - log.actual_rpe;
      if (deviation > thresholds.rpe_deviation_threshold) {
        lowRun++;
        lastLowDeviation = deviation;
      } else {
        lowRun = 0;
      }
      if (lowRun >= thresholds.consecutive_sessions_required) {
        const roundedDev = Math.round(lastLowDeviation * 10) / 10;
        suggestions.push({
          type: 'increase_pct',
          affected_lift: lift,
          affected_block: intensityType,
          pct_adjustment: 0.025,
          rationale: `${lift} ${intensityType} RPE consistently below intended stimulus by ${roundedDev} — increase percentage.`,
        });
        rpeSuggestionsPerLift.set(lift, (rpeSuggestionsPerLift.get(lift) ?? 0) + 1);
        break;
      }
    }
  }

  return suggestions;
}
