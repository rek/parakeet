# Spec: Session Read API

**Status**: Planned
**Domain**: Sessions & Performance

## What This Covers

Read endpoints for sessions. The Today screen and Program view depend on these.

## Tasks

**Repository (`apps/api/src/modules/sessions/sessions.repository.ts`):**
- `findById(sessionId: string, userId: string): Promise<Session | null>`
- `findToday(userId: string): Promise<Session | null>`
  - "Today's session" = nearest upcoming `planned_date >= today` with `status = 'planned'` or `status = 'in_progress'`
  - If no session today, returns tomorrow's session (the "next upcoming")
- `findByWeek(programId: string, weekNumber: number): Promise<Session[]>`
- `findByStatus(userId: string, status: SessionStatus, pagination: PaginationParams): Promise<PaginatedResult<Session>>`

**Routes:**
- `GET /v1/sessions/today`
  - Returns the next upcoming session (not yet completed or skipped)
  - Includes `planned_sets` JSONB, session metadata, and active edge case banner data if any
  - 204 No Content if no upcoming sessions (program complete or no program)

- `GET /v1/sessions/:sessionId`
  - Full session detail with `planned_sets`
  - Returns `404` if not found or doesn't belong to user

- `GET /v1/sessions`
  - Filter: `?week=1&status=planned&program_id=uuid`
  - Returns sessions without the full `planned_sets` JSONB in list (summary: weight range, session type)
  - Cursor-based pagination

## Dependencies

- [programs-002-program-generation-api.md](./programs-002-program-generation-api.md)
