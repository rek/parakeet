# Spec: Today Screen

**Status**: Planned
**Domain**: Mobile App

## What This Covers

The home tab that shows the user's next upcoming session and any active disruption banners.

## Tasks

**`apps/mobile/app/(tabs)/today.tsx`:**
- On mount: call `GET /v1/sessions/today` via React Query (cache: 30 seconds, background refetch on focus)
- Three states:
  1. **Session found**: render `WorkoutCard` component
  2. **No session (rest day or program complete)**: render rest day message with next session date
  3. **No active program**: render "Create Your Program" CTA button → navigate to onboarding

**`apps/mobile/components/training/WorkoutCard.tsx`:**
- Props: `session: Session`, `onStart: () => void`
- Header: week and block label ("Block 2 / Week 4 — Squat Heavy")
- Body: primary lift name, intensity type badge, planned sets summary ("2 sets × 3 reps at 267.5 lbs")
- Footer: planned date, "Start Workout" primary button, "Skip" secondary button (sheet confirmation)
- Active disruption banner above the card if any active disruptions for today's lift
  - Amber background strip: "Knee injury active — Squat load reduced 20%"
  - Tap → navigate to `disruption-report/report.tsx` in detail view

**"Skip" confirmation sheet:**
- Bottom sheet slides up
- "Reason (optional)" text field
- "Skip Session" red button + "Cancel" button
- On confirm: call `PATCH /v1/sessions/:sessionId/skip`

**"Start Workout" navigation:**
- Navigate to `session/[sessionId]` with session ID in URL

**React Query hook (`apps/mobile/hooks/useActiveSession.ts`):**
- `useTodaySession()` — wraps `GET /v1/sessions/today`
- Returns `{ session, isLoading, error, refetch }`

## Dependencies

- [mobile-001-expo-router-layout.md](./mobile-001-expo-router-layout.md)
- [sessions-001-session-read-api.md](../07-sessions/sessions-001-session-read-api.md)
- [disruptions-003-resolution.md](../08-disruptions/disruptions-003-resolution.md)
