# Spec: Report Disruption

**Status**: Implemented
**Domain**: Disruptions

## What This Covers

Creating a disruption record and returning suggested adjustments for user review. Supabase SDK called directly from the app — no backend, no Pub/Sub.

## Tasks

**`apps/mobile/lib/disruptions.ts`:**

```typescript
import { supabase } from './supabase'
import { suggestDisruptionAdjustment } from '@parakeet/training-engine'
import type { CreateDisruptionInput, TrainingDisruptionWithSuggestions } from '@parakeet/shared-types'

export async function reportDisruption(
  userId: string,
  input: CreateDisruptionInput
): Promise<TrainingDisruptionWithSuggestions> {
  // 1. Insert disruption row (status='active', adjustment_applied=null)
  const { data: disruption, error } = await supabase
    .from('disruptions')
    .insert({
      user_id: userId,
      disruption_type: input.disruption_type,
      severity: input.severity,
      affected_date_start: input.affected_date_start,
      affected_date_end: input.affected_date_end ?? null,
      affected_lifts: input.affected_lifts ?? null,
      description: input.description ?? null,
      session_ids_affected: input.session_ids_affected ?? null,
      status: 'active',
    })
    .select()
    .single()

  if (error) throw error

  // 2. Fetch affected sessions (RLS ensures they belong to this user)
  const sessionIds = input.session_ids_affected ?? []
  const affectedSessions = sessionIds.length > 0
    ? (await supabase
        .from('sessions')
        .select('id, primary_lift, planned_sets, status')
        .in('id', sessionIds)
        .in('status', ['planned', 'in_progress'])
      ).data ?? []
    : []

  // 3. Generate suggestions locally using training-engine
  const suggestedAdjustments = suggestDisruptionAdjustment(disruption, affectedSessions)

  // 4. Return disruption + suggestions (NOT yet applied)
  return { ...disruption, suggested_adjustments: suggestedAdjustments }
}
```

**Input shape (`CreateDisruptionInput` in `packages/shared-types/src/disruption.schema.ts`):**
- `disruption_type`: 'injury' | 'illness' | 'travel' | 'fatigue' | 'equipment_unavailable' | 'unprogrammed_event' | 'other'
- `severity`: 'minor' | 'moderate' | 'major'
- `affected_date_start`: date string
- `affected_date_end?`: date string (null = ongoing)
- `affected_lifts?`: string[] (null = all lifts)
- `description?`: free text
- `session_ids_affected?`: UUID[] of specific sessions

**Suggested adjustment shape:**
```json
{
  "session_id": "uuid",
  "action": "weight_reduced",
  "reduction_pct": 20,
  "rationale": "Minor injury: reduce intensity to maintain movement pattern safely"
}
```

Suggestions are returned to the UI for review — they are not applied until the user confirms (see `disruptions-002-apply-adjustment.md`).

## Dependencies

- [disruptions-004-adjuster-engine.md](./disruptions-004-adjuster-engine.md)
- [programs-002-program-generation-api.md](../06-programs/programs-002-program-generation-api.md)
