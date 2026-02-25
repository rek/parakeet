# Spec: History Screen

**Status**: Implemented (no spec written)
**Domain**: parakeet App

## What This Covers

The History tab showing performance trends, completed sessions, and archived programs. Written retroactively to document the implemented screen.

## Tasks

**`apps/parakeet/app/(tabs)/history.tsx`** — already implemented. Documents the current implementation.

### Sections

**Performance Trends (top section):**
- Per-lift trend cards: Squat / Bench / Deadlift
- Each card: estimated 1RM trend line (chart) over last N sessions with RPE data
- Fetched via `getPerformanceTrends(userId, lift)` from `apps/parakeet/src/lib/performance.ts`
- Trend direction badge: ↑ / → / ↓ based on slope of last 4 estimates
- Tapping a card expands to show individual session data points

**Completed Sessions (middle section):**
- Chronological list of completed sessions, most recent first
- Each row: date, lift name, intensity type, actual volume (sets × reps × weight), session RPE
- Filterable by lift (Squat / Bench / Deadlift / All) via tab chips at section header
- Tapping a row shows session detail: planned vs. actual sets side-by-side, notes, any PRs earned, disruption if active

**Archived Programs (bottom section):**
- List of completed and abandoned programs, most recent first
- Each row: program start/end date, week count, final estimated 1RMs
- "Review" button → navigates to `history/cycle-review/[programId].tsx` (mobile-014)
- Abandoned programs (not ≥80% complete): shown with a "Incomplete" badge, no Review button

### Data Access

Uses existing functions in `apps/parakeet/src/lib/`:
- `getCompletedSessions(userId)` from `sessions.ts`
- `getPerformanceTrends(userId, lift)` from `performance.ts`
- `listPrograms(userId)` from `programs.ts` (returns all statuses including archived)
- `getCurrentWeekLogs(userId)` from `sessions.ts` (for the trend calculation)

React Query hooks (from `mobile-008`): `usePerformanceTrends`, `useCompletedSessions` — cached 2 min.

### PRs in Session Detail

Session detail view shows any PRs earned on that session (reads from `personal_records` table, filtered by `session_id`). Added as part of engine-022/mobile-019 implementation.

## Dependencies

- [sessions-005-performance-read-api.md](../07-sessions/sessions-005-performance-read-api.md) — performance data
- [mobile-014-cycle-review-screen.md](./mobile-014-cycle-review-screen.md) — Review button navigates here
- [engine-022-pr-detection.md](../04-engine/engine-022-pr-detection.md) — PR data in session detail
