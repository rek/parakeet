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

## Open Issues (2026-05 review)

- [ ] **Calibration prompt button labels read backwards.** The calibration adjustment is already applied to the DB before the prompt fires; the buttons are:
  - "Sounds right" → just dismisses (keeps the newly applied value)
  - "Keep current" → reverts to the pre-prompt value
  Reading "Keep current" naturally means "keep whatever is current right now" (= the newly applied value), but the code reverts. Rename to `Accept change` / `Revert change` and add a one-line copy clarifying that the change is already in effect until they tap Revert. Also: "Sounds right" should persist user acceptance (e.g., `upsertModifierCalibration` with `confidence: 'high'`) instead of just deleting the AsyncStorage key — currently the engine has no signal the calibration was confirmed.
- [ ] **Volume card has no error/empty state.** `VolumeCompactCard` shows "Loading…" forever if `useWeeklyVolume` errors out or returns `null`. Expose `isError`/`isPending` and render "Couldn't load volume — tap to retry" or `null` for genuinely empty.
- [ ] **Session-error fallback tile uses the rest-day card with a red border but neutral title text.** Add `style={{ color: colors.danger }}` to the error title and an explicit retry icon so it doesn't read as "rest day."

## Dependencies

- [parakeet-001-expo-router-layout.md](./parakeet-001-expo-router-layout.md)
- [sessions-001-session-read-api.md](./spec-read.md)
- [disruptions-003-resolution.md](../disruptions/spec-resolution.md)

