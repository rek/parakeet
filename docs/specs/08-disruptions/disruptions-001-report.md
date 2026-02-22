# Spec: Disruption Report API

**Status**: Planned
**Domain**: Disruptions

## What This Covers

Creating a disruption record and returning suggested adjustments for user review without applying them.

## Tasks

**Service (`apps/api/src/modules/disruptions/disruptions.service.ts`):**
- `reportDisruption(userId: string, input: CreateDisruptionInput): Promise<TrainingDisruptionWithSuggestions>`
  1. Validate `session_ids_affected` (if provided) belong to user and are in planned/in_progress status
  2. Insert `disruptions` row (status='active', adjustment_applied=null)
  3. Fetch affected sessions with their `planned_sets`
  4. Call `suggestDisruptionAdjustment(disruption, affectedSessions)` from training-engine
  5. Return `disruption` + `suggested_adjustments` array (NOT yet applied)
  6. Publish `disruption.created` Pub/Sub event

**Input shape (`CreateDisruptionInput`):**
- `case_type`: one of injury | illness | travel | fatigue | equipment_unavailable | other
- `severity`: minor | moderate | major
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

## Dependencies

- [disruptions-004-adjuster-engine.md](./disruptions-004-adjuster-engine.md)
- [programs-002-program-generation-api.md](../06-programs/programs-002-program-generation-api.md)
