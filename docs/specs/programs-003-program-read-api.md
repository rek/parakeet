# Spec: Program Read API

**Status**: Planned
**Domain**: Program Management

## What This Covers

Read endpoints for the program resource. The mobile app uses these to render the full program view and the today screen.

## Tasks

**Repository additions:**
- `findById(programId: string, userId: string): Promise<Program | null>` — returns program + all sessions
- `findAll(userId: string, pagination: PaginationParams): Promise<PaginatedResult<Program>>` — list without sessions (summary only)

**Routes:**
- `GET /v1/programs/active`
  - Returns active program with full session list
  - Sessions include `planned_sets` JSONB and `status`
  - Response shape: `{ ...program, sessions: Session[] }`
  - 404 if no active program exists

- `GET /v1/programs/:programId`
  - Returns full program including all sessions
  - Validates program belongs to authenticated user (403 if not)

- `GET /v1/programs`
  - Returns list of programs (no sessions in list response)
  - Supports `?status=active|archived|completed` filter
  - Cursor-based pagination: `?limit=20&cursor=<opaque>`
  - Response: `{ items: Program[], next_cursor: string | null }`

**PATCH `/v1/programs/:programId/status`:**
- Allows transitioning: `active → completed`, `active → archived`
- Validates no other program is `active` before restoring an archived one
- Does not allow re-activating a completed program

## Dependencies

- [programs-002-program-generation-api.md](./programs-002-program-generation-api.md)
