# Spec: Program View Screen

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

The Program tab showing the full 10-week program in a scannable week-grid format, with expandable week rows and session status indicators.

## Tasks

**`apps/parakeet/app/(tabs)/program.tsx`:**
- On mount: fetch active program via `useActiveProgram()` hook calling `getActiveProgram(userId)` from `programs-003` (React Query, cache 5 minutes)
- Header: program title, block progress indicator ("Block 2 of 3 — Week 5 of 10")
- Scrollable list of `WeekRow` components (one per week)
- Current week: auto-expanded, scrolled into view on mount

**`apps/parakeet/components/program/WeekGrid.tsx`:**
- Renders the list of `WeekRow` components
- Accepts `program: Program` as prop

**`apps/parakeet/components/program/WeekRow.tsx`:**
- Collapsed state: week number, block badge (color-coded), completion indicator (e.g., "2/3 sessions done")
- Tap to expand → shows SessionSummary cards for each session in the week
- Deload week: grey badge, "Deload" label

**`apps/parakeet/components/program/BlockBadge.tsx`:**
- Props: `blockNumber: 1 | 2 | 3 | 'deload'`
- Block 1: blue badge with "B1"
- Block 2: orange badge with "B2"
- Block 3: red badge with "B3"
- Deload: grey badge with "DL"

**`apps/parakeet/components/program/SessionSummary.tsx`:**
- Props: `session: Session`
- Uses `useInProgressSession()` hook internally to determine locked state
- Shows: primary lift, intensity type, planned/completed date, block badge
- Status indicator dot + row behaviour:
  - `planned` (no active session): grey dot, tappable → soreness check-in
  - `planned` (another session in_progress): row dimmed to 45% opacity + 🔒 icon, tap disabled
  - `in_progress`: lime green dot + green "Active" pill badge, tappable → navigates **directly to session screen** (bypasses soreness)
  - `completed`: green dot, not tappable
  - `skipped`: red dot + red "Skipped" pill badge (same style as "Active"), not tappable
  - `missed`: red dot + red "Missed" pill badge, not tappable

**No program state:**
- If `getActiveProgram()` returns `null`, show "No active program" with "Create Program" button

## Dependencies

- [parakeet-001-expo-router-layout.md](./parakeet-001-expo-router-layout.md)
- [programs-003-program-read-api.md](./spec-read-api.md)
