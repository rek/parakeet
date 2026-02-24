# Spec: Disruption Adjuster Engine

**Status**: Implemented
**Domain**: Disruptions

## What This Covers

The `suggestDisruptionAdjustment` function in `packages/training-engine` that maps disruption type + severity to concrete session modification suggestions.

## Tasks

**File: `packages/training-engine/src/adjustments/disruption-adjuster.ts`**

- `suggestDisruptionAdjustment(disruption: TrainingDisruptionInput, sessions: PlannedSession[]): DisruptionAdjustmentSuggestion[]`

**Adjustment mapping rules:**

| Type | Severity | Action | Reduction |
|------|----------|--------|-----------|
| injury | minor | weight_reduced | 20% |
| injury | moderate | weight_reduced | 40% |
| injury | major | session_skipped | 100% |
| illness | minor | volume_reduced | reps -2 per set |
| illness | moderate | weight_reduced | 25% + reps -2 |
| illness | major | session_skipped | 100% |
| travel | any | weight_reduced (if equipment limited) | 30%, note suggests bodyweight substitutions |
| fatigue | minor | weight_reduced | 10% |
| fatigue | moderate | weight_reduced | 20% |
| fatigue | major | session_skipped | 100% |
| equipment_unavailable | any | session_skipped or substitution note | — |

**Affected lift filtering:**
- If `disruption.affected_lifts` is populated, only generate adjustments for sessions where `session.primary_lift` is in the list
- If null/empty, all sessions in the date range are affected

**Return type:**
```typescript
interface DisruptionAdjustmentSuggestion {
  session_id: string
  action: 'weight_reduced' | 'reps_reduced' | 'session_skipped' | 'exercise_substituted'
  reduction_pct?: number
  reps_reduction?: number
  rationale: string
  substitution_note?: string
}
```

**Unit tests (`packages/training-engine/__tests__/disruption-adjuster.test.ts`):**
- Minor injury affecting squat → 20% weight reduction, bench/DL unchanged
- Major illness → all sessions skipped
- Travel → 30% weight reduction on all sessions with substitution note
- Fatigue affecting deadlift only → 10% DL weight reduction, squat/bench unchanged
- Major injury: session_skipped action returned, not weight_reduced

## Dependencies

- [engine-004-program-generator.md](../04-engine/engine-004-program-generator.md)
