# Spec: Today Screen

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

The home tab that shows the user's next upcoming session and any active disruption banners.

## Tasks

**`apps/parakeet/app/(tabs)/today.tsx`:**
- On mount: call `useTodaySession()` hook via React Query (cache: 30 seconds, background refetch on focus)
- Four states:
  1. **Session completed today** (`session.status === 'completed'`): render "Workout Done ✓" card with lift name
  2. **Session found** (in_progress or planned): render `WorkoutCard` component
  3. **No session (rest day or program complete)**: render rest day message with next session date
  4. **No active program**: render "Create Your Program" CTA button → navigate to onboarding

**`apps/parakeet/components/training/WorkoutCard.tsx`:**
- Props: `session: Session`, `onStart: () => void`
- Header: week and block label ("Block 2 / Week 4 — Squat Heavy")
- Body: primary lift name, intensity type badge, planned sets summary ("2 sets × 3 reps at 267.5 kg")
- Footer: planned date, "Start Workout" primary button, "Skip" secondary button (sheet confirmation)
- Active disruption banner above the card if any active disruptions for today's lift
  - Amber background strip: "Knee injury active — Squat load reduced 20%"
  - Tap → navigate to `disruption-report/report.tsx` in detail view

**"Skip" confirmation sheet:**
- Bottom sheet slides up
- "Reason (optional)" text field
- "Skip Session" red button + "Cancel" button
- On confirm: `supabase.from('sessions').update({ status: 'skipped' }).eq('id', sessionId)` (via `skipSession(sessionId)` helper in `apps/parakeet/lib/sessions.ts`)

**"Start Workout" navigation:**
- Navigate to `session/[sessionId]` with session ID in URL

**React Query hook (`apps/parakeet/src/modules/session/hooks/useTodaySession.ts`):**
- `useTodaySession()` — selects session in priority order:
  1. Active `in_progress` session (earliest `planned_date` if multiple)
  2. `completed` session with `planned_date = today` (enables "Workout Done" state)
  3. Nearest `planned` session by `planned_date` ascending
  4. `null` → rest-day / program-complete state
- Returns `{ data: session, isLoading, error }`

**Foreground reconciliation (in app `_layout.tsx` or Today mount):**
- On app foreground / Today tab focus: call `markMissedSessions(userId)` then invalidate `['session', 'today']` and `['sessions']` React Query keys

## Dependencies

- [parakeet-001-expo-router-layout.md](./parakeet-001-expo-router-layout.md)
- [sessions-001-session-read-api.md](../07-sessions/sessions-001-session-read-api.md)
- [disruptions-003-resolution.md](../08-disruptions/disruptions-003-resolution.md)

