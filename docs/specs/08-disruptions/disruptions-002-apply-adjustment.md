# Spec: Apply Disruption Adjustment API

**Status**: Planned
**Domain**: Disruptions

## What This Covers

The user has reviewed the suggested adjustments and confirmed they want to apply them.

## Tasks

**Service (`disruptions.service.ts` addition):**
- `applyAdjustment(disruptionId: string, userId: string): Promise<TrainingDisruption>`
  1. Fetch disruption — validate belongs to user, status='active', `adjustment_applied` is null
  2. Re-fetch suggested adjustments (re-call engine; or retrieve from temporary storage if we cached them)
  3. Begin transaction:
     a. For each affected session:
        - If action = `'weight_reduced'`: recalculate each set weight: `weight × (1 - reduction_pct/100)`, round to 2.5, update `planned_sets` JSONB
        - If action = `'session_skipped'`: update `session.status = 'skipped'`, add note
        - If action = `'reps_reduced'`: update each set's `reps` field in `planned_sets` JSONB
     b. Update `disruptions.adjustment_applied` JSONB with what was applied and which sessions were modified
  4. Return updated disruption

**Note on session modification:** Sessions are mutable (planned_sets can be updated before completion). The original planned_sets from `programs.program_snapshot` is preserved as the immutable reference; the `sessions` row reflects the adjusted plan.

**Route:**
- `POST /v1/disruptions/:disruptionId/apply-adjustment`
  - No request body (the suggestion to apply was already determined at report time)
  - Returns updated `TrainingDisruption` with `adjustment_applied` populated

## Dependencies

- [disruptions-001-report.md](./disruptions-001-report.md)
