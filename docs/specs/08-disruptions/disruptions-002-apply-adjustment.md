# Spec: Apply Disruption Adjustment

**Status**: Implemented
**Domain**: Disruptions

## What This Covers

The user has reviewed the suggested adjustments and confirmed they want to apply them. Updates session `planned_sets` directly in Supabase.

## Tasks

**`apps/mobile/lib/disruptions.ts` (addition):**

```typescript
export async function applyDisruptionAdjustment(
  disruptionId: string,
  userId: string
): Promise<void> {
  // 1. Fetch the disruption (RLS ensures ownership)
  const { data: disruption } = await supabase
    .from('disruptions')
    .select('*')
    .eq('id', disruptionId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('adjustment_applied', null)
    .single()

  if (!disruption) throw new Error('Disruption not found or already applied')

  // 2. Re-generate suggestions from engine (deterministic — same input = same output)
  const sessionIds = disruption.session_ids_affected ?? []
  const affectedSessions = sessionIds.length > 0
    ? (await supabase
        .from('sessions')
        .select('id, primary_lift, planned_sets, status')
        .in('id', sessionIds)
      ).data ?? []
    : []

  const suggestions = suggestDisruptionAdjustment(disruption, affectedSessions)

  // 3. Apply adjustments to each session
  for (const suggestion of suggestions) {
    if (suggestion.action === 'weight_reduced' && suggestion.reduction_pct) {
      const session = affectedSessions.find(s => s.id === suggestion.session_id)
      if (!session?.planned_sets) continue

      const adjustedSets = session.planned_sets.map((set: PlannedSet) => ({
        ...set,
        weight_kg: roundToNearest2_5(set.weight_kg * (1 - suggestion.reduction_pct / 100)),
      }))

      await supabase
        .from('sessions')
        .update({ planned_sets: adjustedSets })
        .eq('id', suggestion.session_id)
    }

    if (suggestion.action === 'session_skipped') {
      await supabase
        .from('sessions')
        .update({ status: 'skipped' })
        .eq('id', suggestion.session_id)
    }

    if (suggestion.action === 'reps_reduced' && suggestion.reps_modifier) {
      const session = affectedSessions.find(s => s.id === suggestion.session_id)
      if (!session?.planned_sets) continue

      const adjustedSets = session.planned_sets.map((set: PlannedSet) => ({
        ...set,
        reps: Math.max(1, set.reps + suggestion.reps_modifier),
      }))

      await supabase
        .from('sessions')
        .update({ planned_sets: adjustedSets })
        .eq('id', suggestion.session_id)
    }
  }

  // 4. Record what was applied on the disruption row
  await supabase
    .from('disruptions')
    .update({ adjustment_applied: suggestions })
    .eq('id', disruptionId)
}
```

**Weight rounding:** `roundToNearest2_5(kg)` from `@parakeet/training-engine` — rounds to nearest 2.5 kg, minimum 20 kg.

**Session mutability:** `sessions.planned_sets` is mutable until the session is completed. The original JIT context is preserved in `sessions.jit_input_snapshot` (JSONB) for debugging and audit purposes. There is no separate `program_snapshot` field.

**JIT-not-yet-generated sessions:** If `planned_sets` is null (JIT hasn't run yet), adjustments cannot be applied until JIT runs. The disruption should be noted as `activeDisruptions` in the `JITInput`; the `FormulaJITGenerator` and `LLMJITGenerator` both handle active disruptions during session generation (see `engine-007`).

## Dependencies

- [disruptions-001-report.md](./disruptions-001-report.md)
