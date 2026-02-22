# Spec: Session Lifecycle API

**Status**: Planned
**Domain**: Sessions & Performance

## What This Covers

Endpoints for transitioning session status: starting, skipping. Session completion is covered in sessions-003.

## Tasks

**Service (`apps/api/src/modules/sessions/sessions.service.ts`):**
- `startSession(sessionId: string, userId: string): Promise<Session>`
  - Validates session belongs to user
  - Validates current status is `'planned'` (cannot start a skipped or completed session)
  - Updates `status = 'in_progress'`, sets `started_at = NOW()`
  - Returns updated session

- `skipSession(sessionId: string, userId: string, reason?: string): Promise<Session>`
  - Validates status is `'planned'` or `'in_progress'` (can skip an in-progress session)
  - Updates `status = 'skipped'`
  - Stores reason in session `notes` field (nullable)
  - Does NOT create a `session_log` row (skip is not a performance log)

**Routes:**
- `POST /v1/sessions/:sessionId/start`
  - No request body required
  - Returns updated session

- `PATCH /v1/sessions/:sessionId/skip`
  - Request body: `{ reason?: string }` (optional)
  - Returns updated session

**Status transition validation:**
- `planned → in_progress`: valid
- `planned → skipped`: valid
- `in_progress → skipped`: valid
- `completed → *`: invalid (completed sessions are immutable)
- `skipped → *`: invalid (skipped sessions are immutable)

## Dependencies

- [sessions-001-session-read-api.md](./sessions-001-session-read-api.md)
