# Spec: Disruption Resolution API

**Status**: Planned
**Domain**: Disruptions

## What This Covers

Endpoints for resolving disruptions (marking them done) and listing active/historical disruptions. Includes the data for the home screen active disruption banner.

## Tasks

**Repository (`apps/api/src/modules/disruptions/disruptions.repository.ts`):**
- `findActive(userId: string): Promise<TrainingDisruption[]>` — `status != 'resolved'` for this user
- `findAll(userId: string, pagination): Promise<PaginatedResult<TrainingDisruption>>`
- `findById(disruptionId: string, userId: string): Promise<TrainingDisruption | null>`
- `resolve(disruptionId: string, userId: string, resolvedAt?: Date): Promise<TrainingDisruption>`

**Service:**
- `resolveDisruption(disruptionId: string, userId: string, resolvedAt?: string): Promise<TrainingDisruption>`
  - Validates disruption is active (not already resolved)
  - Sets `status = 'resolved'`, `resolved_at = resolvedAt ?? NOW()`
  - If `resolved_at` is in the past (user says "I recovered 2 days ago"), sessions after that date revert to their original planned weights from `programs.program_snapshot` JSONB

**Routes:**
- `PATCH /v1/disruptions/:disruptionId/resolve`
  - Request body: `{ resolved_at?: string }` (ISO date; defaults to now)

- `GET /v1/disruptions`
  - Query: `?status=active|resolved|all` (default: all)
  - Returns list with key fields (no nested session details in list)

- `GET /v1/disruptions/:disruptionId`
  - Full detail including `adjustment_applied` JSONB and linked session summaries

**Home screen banner data:**
- The `GET /v1/sessions/today` response includes an `active_disruptions` array for the Today screen banner:
  ```json
  { "active_disruptions": [{ "case_type": "injury", "severity": "minor", "affected_lifts": ["squat"], "description": "Left knee pain" }] }
  ```

## Dependencies

- [disruptions-002-apply-adjustment.md](./disruptions-002-apply-adjustment.md)
