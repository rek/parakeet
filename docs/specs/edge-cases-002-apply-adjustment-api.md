# Spec: Apply Edge Case Adjustment API

**Status**: Planned
**Domain**: Edge Cases

## What This Covers

The `POST /v1/edge-cases/:caseId/apply-adjustment` endpoint. The user has reviewed the suggested adjustments and confirmed they want to apply them.

## Tasks

**Service (`edge-cases.service.ts` addition):**
- `applyAdjustment(caseId: string, userId: string): Promise<EdgeCase>`
  1. Fetch edge case — validate belongs to user, status='active', `adjustment_applied` is null
  2. Re-fetch suggested adjustments (re-call engine; or retrieve from temporary storage if we cached them)
  3. Begin transaction:
     a. For each affected session:
        - If action = `'weight_reduced'`: recalculate each set weight: `weight × (1 - reduction_pct/100)`, round to 2.5, update `planned_sets` JSONB
        - If action = `'session_skipped'`: update `session.status = 'skipped'`, add note
        - If action = `'reps_reduced'`: update each set's `reps` field in `planned_sets` JSONB
     b. Update `edge_cases.adjustment_applied` JSONB with what was applied and which sessions were modified
  4. Return updated edge case

**Note on session modification:** Sessions are mutable (planned_sets can be updated before completion). The original planned_sets from `programs.program_snapshot` is preserved as the immutable reference; the `sessions` row reflects the adjusted plan.

**Route:**
- `POST /v1/edge-cases/:caseId/apply-adjustment`
  - No request body (the suggestion to apply was already determined at report time)
  - Returns updated `EdgeCase` with `adjustment_applied` populated

## Dependencies

- [edge-cases-001-report-api.md](./edge-cases-001-report-api.md)
