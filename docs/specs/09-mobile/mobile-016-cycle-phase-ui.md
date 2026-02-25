# Spec: Cycle Phase UI Integrations

**Status**: Planned
**Domain**: parakeet App

## What This Covers

All UI surfaces that display or respond to cycle phase context: the Today screen indicator, the ovulatory info chip on squat sessions, the "Menstrual symptoms" disruption sub-type, cycle phase on session history items, and the cycle patterns history view.

None of these changes alter loading — they are informational context only.

## Tasks

### 1. Today Screen — Phase Indicator Pill

**`apps/parakeet/src/app/(tabs)/today.tsx`:**

- Import `useCyclePhase` hook
- If `cycleContext` is non-null (tracking enabled, period start logged): render a pill below the screen title

```
[Follicular · Day 9]
```

- Pill style: small, borderRadius, subtle background color per phase:
  - menstrual: `#FEE2E2` (light red)
  - follicular: `#D1FAE5` (light green)
  - ovulatory: `#FEF3C7` (light amber)
  - luteal / late_luteal: `#E0E7FF` (light indigo)
- Tap → navigate to `/settings/cycle-tracking` (so user can update if needed)

### 2. Today Screen — Ovulatory Info Chip

**`apps/parakeet/src/app/(tabs)/today.tsx`:**

- When `cycleContext.isOvulatoryWindow === true` AND today's session is squat-focused (primaryLift === 'squat'):
- Render a subtle info banner below the workout card:

```
ℹ Ovulatory phase — high-load squat day. Focus on knee tracking and warm-up quality.
```

- Style: amber-tinted (`#FFFBEB` background, `#92400E` text), small info icon, no action button
- This is NOT a disruption — no routing to disruption report, no load adjustment
- Only shown if cycle tracking enabled; only shown for squat sessions

### 3. Disruption Report — "Menstrual Symptoms" Sub-type

**`apps/parakeet/src/app/disruption-report/report.tsx`:**

In the disruption type step, under "Fatigue" type options, add:
- Option: **"Menstrual symptoms"** (shown only if `user.biological_sex === 'female'`)
- On select: auto-sets severity to `minor`, affected lifts to `['squat', 'bench', 'deadlift']` (all lifts)
- User can still adjust severity and lifts before submitting
- Flows through the existing disruption pipeline — no special-cased logic
- In history, shows "Menstrual symptoms" as the disruption description

### 4. Session History — Cycle Phase Tag

**`apps/parakeet/src/app/(tabs)/history.tsx`:**

- For each past session card/row: if `session_log.cycle_phase` is non-null, show a small phase tag alongside the session date

```
[Wed Feb 12]  Squat Heavy  [Follicular]
```

- Tag style: same color coding as the Today pill (phase → pastel color)
- Only shown if the `cycle_phase` column is populated (i.e., tracking was active during that session)

### 5. History — Cycle Patterns View

**`apps/parakeet/src/app/history/cycle-patterns.tsx`** (new screen):

Navigation: History tab → "Cycle Patterns" button (only visible if cycle tracking is enabled and ≥1 session has `cycle_phase` populated).

**Content:**
- Chart: bar or line, X-axis = cycle phase, Y-axis = average session RPE per phase
- Second chart (or same chart with dual Y): average volume completed per phase
- Data grouping: aggregate all logged sessions that have a `cycle_phase` value
- Summary text generated from the data: "Your average RPE in the luteal phase ({N.N}) is higher than in the follicular phase ({N.N}). This is common."
- No phase-specific load recommendations — this is a retrospective pattern view only
- "Minimum data notice" shown if fewer than 2 cycles worth of data: "Keep tracking — patterns become visible after 2–3 cycles"

**`apps/parakeet/src/app/history/_layout.tsx`:** already a Stack — no changes needed, just add the new route file.

**`apps/parakeet/src/app/(tabs)/history.tsx`:** add a "Cycle Patterns" button/row in the history tab when tracking is enabled.

## Dependencies

- [data-005-cycle-tracking.md](../05-data/data-005-cycle-tracking.md) — `useCyclePhase` hook
- [engine-014-cycle-phase-calculator.md](../04-engine/engine-014-cycle-phase-calculator.md) — `CyclePhase` type
- [mobile-015-cycle-tracking-settings.md](./mobile-015-cycle-tracking-settings.md) — settings screen
- [mobile-004-today-screen.md](./mobile-004-today-screen.md) — Today screen base
- [mobile-010-disruption-report-screen.md](./mobile-010-disruption-report-screen.md) — disruption report base
