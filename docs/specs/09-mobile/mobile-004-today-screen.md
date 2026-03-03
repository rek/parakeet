# Spec: Today Screen

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

The home tab that shows the user's next upcoming session and any active disruption banners.

## Tasks

**`apps/parakeet/app/(tabs)/today.tsx`:**
- On mount: call `useTodaySession()` hook via React Query (cache: 30 seconds, background refetch on focus)
- Three states:
  1. **Session found**: render `WorkoutCard` component
  2. **No session (rest day or program complete)**: render rest day message with next session date
  3. **No active program**: render "Create Your Program" CTA button → navigate to onboarding

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

**React Query hook (`apps/parakeet/hooks/useActiveSession.ts`):**
- `useTodaySession()` — selects session in priority order:
  1. Session with `status = in_progress` (earliest `planned_date` if multiple)
  2. Otherwise nearest `planned` session by `planned_date` ascending (not same-date-only)
  3. Otherwise `null` → rest-day / program-complete state
- Does **not** include `completed` sessions in the result
- Returns `{ session, isLoading, error, refetch }`

**Foreground reconciliation (in app `_layout.tsx` or Today mount):**
- On app foreground / Today tab focus: call `markMissedSessions(userId)` then invalidate `['session', 'today']` and `['sessions']` React Query keys

## Dependencies

- [parakeet-001-expo-router-layout.md](./parakeet-001-expo-router-layout.md)
- [sessions-001-session-read-api.md](../07-sessions/sessions-001-session-read-api.md)
- [disruptions-003-resolution.md](../08-disruptions/disruptions-003-resolution.md)

