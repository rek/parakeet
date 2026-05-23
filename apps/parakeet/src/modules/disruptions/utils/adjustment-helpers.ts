// @spec docs/features/disruptions/spec-apply.md
import type {
  AdjustmentSuggestion,
  SessionImpactPreview,
} from '@parakeet/shared-types';

export function describeAction(suggestion: AdjustmentSuggestion): string {
  switch (suggestion.action) {
    case 'session_skipped':
      return 'Session skipped';
    case 'weight_reduced':
      return suggestion.reduction_pct != null
        ? `Weight reduced by ${suggestion.reduction_pct}%`
        : 'Weight reduced';
    case 'reps_reduced':
      return suggestion.reps_reduction != null
        ? `Reps reduced by ${suggestion.reps_reduction}`
        : 'Reps reduced';
    case 'exercise_substituted':
      return suggestion.substitution_note ?? 'Exercise substituted';
  }
}

/** One-line "before → after" label for a session impact preview row. Used
 *  by the review screen's per-session impact list (finding #4). */
export function formatImpactAction(row: SessionImpactPreview): string {
  switch (row.action) {
    case 'session_skipped':
      return 'Skipped';
    case 'weight_reduced':
      if (row.before_weight_kg != null && row.after_weight_kg != null) {
        return `${row.before_weight_kg}kg → ${row.after_weight_kg}kg`;
      }
      return 'Weight reduced';
    case 'reps_reduced':
      if (row.before_reps != null && row.after_reps != null) {
        return `${row.before_reps} reps → ${row.after_reps} reps`;
      }
      return 'Reps reduced';
    case 'exercise_substituted':
      return 'Substitute exercise';
  }
}

export function groupSuggestions(
  suggestions: AdjustmentSuggestion[]
): Map<string, { s: AdjustmentSuggestion; count: number }> {
  return suggestions.reduce<
    Map<string, { s: AdjustmentSuggestion; count: number }>
  >((acc, s) => {
    const key = describeAction(s);
    const existing = acc.get(key);
    if (existing) {
      existing.count++;
    } else {
      acc.set(key, { s, count: 1 });
    }
    return acc;
  }, new Map());
}
