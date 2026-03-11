import type { AdjustmentSuggestion } from '@parakeet/shared-types';

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
