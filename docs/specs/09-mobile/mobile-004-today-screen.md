# Spec: Today Screen

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

The home tab that shows all of today's sessions and any active disruption banners.

## Tasks

**`apps/parakeet/app/(tabs)/today.tsx`:**
- On mount: call `useTodaySessions()` hook (plural) via React Query (cache: 30 seconds, background refetch on focus)
- Also fetches `useInProgressSession()` to determine locked state for planned sessions
- States:
  1. **No active program**: render "Create Your Program" CTA button → navigate to onboarding
  2. **No sessions for today**: render rest day card
  3. **One or more sessions**: completed sessions grouped into a single `WorkoutDoneCard`; remaining sessions sorted by status priority (in_progress → planned → skipped)
     - All `completed` → single `WorkoutDoneCard` showing lift names + LLM motivational message (see [mobile-029-motivational-message.md](./mobile-029-motivational-message.md))
     - `in_progress` / `planned` → `WorkoutCard`; planned sessions show `isLocked=true` if another session is already in_progress

**`apps/parakeet/components/training/WorkoutCard.tsx`:**
- Props: `session: Session`, `onSkipComplete?: () => void`, `isLocked?: boolean`
- Header: week and block label, intensity badge
- Body: primary lift name, planned sets summary
- Footer: planned date, action button
  - `in_progress` → "Resume Workout" (navigates directly to session screen, bypasses soreness)
  - `planned`, not locked → "Start Workout" (navigates to soreness check-in)
  - `planned`, locked → greyed "Another session active" (no-op, tap disabled)
- Skip button only shown when not `in_progress` and not locked

**"Skip" confirmation sheet:**
- Bottom sheet slides up with optional reason field
- On confirm: `skipSession(sessionId)` → `sessions.status = 'skipped'`

**React Query hooks (`apps/parakeet/src/modules/session/hooks/`):**
- `useTodaySessions()` — fetches all sessions where `planned_date = today` OR `status = in_progress`; deduplicated; ordered by `planned_date asc`
- `useInProgressSession()` — fetches the active in_progress session (if any); 10s stale time; shared/deduplicated by React Query across all consumers
- `useTodaySession()` (singular, still exists) — priority-ordered single session for other consumers

**Foreground reconciliation:**
- On app foreground / Today tab focus: call `markMissedSessions(userId)` then invalidate `['session', 'today']` React Query prefix

## Dependencies

- [parakeet-001-expo-router-layout.md](./parakeet-001-expo-router-layout.md)
- [sessions-001-session-read-api.md](../07-sessions/sessions-001-session-read-api.md)
- [disruptions-003-resolution.md](../08-disruptions/disruptions-003-resolution.md)

