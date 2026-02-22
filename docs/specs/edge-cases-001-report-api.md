# Spec: Edge Case Report API

**Status**: Planned
**Domain**: Edge Cases

## What This Covers

The `POST /v1/edge-cases` endpoint. Creates the edge case record and returns suggested adjustments for user review without applying them.

## Tasks

**Service (`apps/api/src/modules/edge-cases/edge-cases.service.ts`):**
- `reportEdgeCase(userId: string, input: CreateEdgeCaseInput): Promise<EdgeCaseWithSuggestions>`
  1. Validate `session_ids_affected` (if provided) belong to user and are in planned/in_progress status
  2. Insert `edge_cases` row (status='active', adjustment_applied=null)
  3. Fetch affected sessions with their `planned_sets`
  4. Call `suggestEdgeCaseAdjustment(edgeCase, affectedSessions)` from training-engine
  5. Return `edge_case` + `suggested_adjustments` array (NOT yet applied)
  6. Publish `edge-case.created` Pub/Sub event

**Input shape (`CreateEdgeCaseInput`):**
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

- [edge-cases-004-adjuster-engine.md](./edge-cases-004-adjuster-engine.md)
- [programs-002-program-generation-api.md](./programs-002-program-generation-api.md)
