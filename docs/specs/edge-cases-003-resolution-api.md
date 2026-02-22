# Spec: Edge Case Resolution API

**Status**: Planned
**Domain**: Edge Cases

## What This Covers

Endpoints for resolving edge cases (marking them done) and listing active/historical edge cases. Includes the data for the home screen active edge case banner.

## Tasks

**Repository (`apps/api/src/modules/edge-cases/edge-cases.repository.ts`):**
- `findActive(userId: string): Promise<EdgeCase[]>` — `status != 'resolved'` for this user
- `findAll(userId: string, pagination): Promise<PaginatedResult<EdgeCase>>`
- `findById(caseId: string, userId: string): Promise<EdgeCase | null>`
- `resolve(caseId: string, userId: string, resolvedAt?: Date): Promise<EdgeCase>`

**Service:**
- `resolveEdgeCase(caseId: string, userId: string, resolvedAt?: string): Promise<EdgeCase>`
  - Validates edge case is active (not already resolved)
  - Sets `status = 'resolved'`, `resolved_at = resolvedAt ?? NOW()`
  - If `resolved_at` is in the past (user says "I recovered 2 days ago"), sessions after that date revert to their original planned weights from `programs.program_snapshot` JSONB

**Routes:**
- `PATCH /v1/edge-cases/:caseId/resolve`
  - Request body: `{ resolved_at?: string }` (ISO date; defaults to now)

- `GET /v1/edge-cases`
  - Query: `?status=active|resolved|all` (default: all)
  - Returns list with key fields (no nested session details in list)

- `GET /v1/edge-cases/:caseId`
  - Full detail including `adjustment_applied` JSONB and linked session summaries

**Home screen banner data:**
- The `GET /v1/sessions/today` response includes a `active_edge_cases` array for the Today screen banner:
  ```json
  { "active_edge_cases": [{ "case_type": "injury", "severity": "minor", "affected_lifts": ["squat"], "description": "Left knee pain" }] }
  ```

## Dependencies

- [edge-cases-002-apply-adjustment-api.md](./edge-cases-002-apply-adjustment-api.md)
