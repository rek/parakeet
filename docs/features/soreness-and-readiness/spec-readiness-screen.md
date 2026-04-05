# Spec: Enhanced Readiness Check-In

**Status**: Draft
**Domain**: Mobile App

## What This Covers

Expands the pre-workout soreness screen to capture full-body muscle soreness (all 9 groups), sleep quality, and energy level. Wires the new signals into JIT generation.

## Tasks

### Expandable "Other Muscles" Section

**File: `apps/parakeet/src/app/(tabs)/session/soreness.tsx`**

Below the existing lift-specific muscle rows and legend, add a collapsible section:

- [ ] Header: "Other muscles" with chevron icon (▸ collapsed, ▾ expanded)
- [ ] Collapsed by default on first use
- [ ] Expansion state persisted via AsyncStorage key `readiness_muscles_expanded`
- [ ] When expanded, shows `MuscleRatingRow` for each muscle NOT in the current lift's primary set
  - Muscles to show: filter `MUSCLE_GROUPS` (all 9) minus `LIFT_PRIMARY_SORENESS_MUSCLES[lift]`
  - Each defaults to 1 (Fresh) or auto-populates from previous check-in like the primary muscles

### Sleep & Energy Quick-Tap Rows

**File: `apps/parakeet/src/app/(tabs)/session/soreness.tsx`**

Add two rows between the muscle section and the "Generate Today's Workout" button:

- [ ] Row 1 — Sleep Quality:
  - Label: "Sleep"
  - 3 pills: "Poor" (1) / "OK" (2) / "Great" (3)
  - Default: 2 (OK)
  - Color: Poor = amber (`#F59E0B`), OK = neutral (gray), Great = green (`#22C55E`)

- [ ] Row 2 — Energy Level:
  - Label: "Energy"
  - 3 pills: "Low" (1) / "Normal" (2) / "High" (3)
  - Default: 2 (Normal)
  - Same color scheme as sleep

Both use the same `TouchableOpacity` pill style as existing soreness ratings but with 3 options instead of 5.

### Cycle Phase Informational Chip

**File: `apps/parakeet/src/app/(tabs)/session/soreness.tsx`**

When cycle tracking is enabled and the current phase has a JIT modifier (menstrual, luteal, late_luteal), show a small chip above the sleep/energy rows:

- [ ] Text: e.g., "Late Luteal — intensity −5%, −1 set"
- [ ] Style: same as Today screen cycle phase pill but with suffix
- [ ] Data source: import `getCurrentCycleContext` from `@modules/cycle-tracking`, call `getCyclePhaseModifier` from `@parakeet/training-engine`
- [ ] Only shown when `modifier.rationale !== null`

### Storage — JSONB Extension

No schema change required. The `soreness_checkins.ratings` JSONB column accepts arbitrary keys.

- [ ] Update `recordSorenessCheckin` call to include all 9 muscles plus:
  ```typescript
  ratings: {
    ...muscleRatings,              // all 9 muscles (primary + expanded)
    sleep_quality: sleepQuality,   // 1 | 2 | 3
    energy_level: energyLevel,     // 1 | 2 | 3
  }
  ```
- [ ] Update `getLatestSorenessCheckin` consumer to extract `sleep_quality` and `energy_level` from the returned ratings for auto-population on subsequent visits.

### JIT Wiring

**File: `apps/parakeet/src/modules/jit/lib/jit.ts`**

In `runJITForSession()`, the soreness check-in ratings are already fetched. Extract the new signals and pass them to `JITInput`:

- [ ] Extract `sleep_quality` and `energy_level` from the ratings JSONB:
  ```typescript
  const checkin = await getLatestSorenessCheckinForSession(sessionId)
  const sleepQuality = checkin?.ratings?.sleep_quality as 1 | 2 | 3 | undefined
  const energyLevel = checkin?.ratings?.energy_level as 1 | 2 | 3 | undefined
  ```
- [ ] Wire cycle phase for female users:
  ```typescript
  const cycleCtx = biologicalSex === 'female'
    ? await getCurrentCycleContext(userId)
    : null
  ```
- [ ] Add all three fields to `JITInput`:
  ```typescript
  const jitInput: JITInput = {
    ...existingFields,
    sleepQuality,
    energyLevel,
    cyclePhase: cycleCtx?.phase,
  }
  ```

### Constants

**File: `apps/parakeet/src/shared/constants/training.ts`**

- [ ] Add readiness label maps:
  ```typescript
  export const READINESS_LABELS = {
    sleep: { 1: 'Poor', 2: 'OK', 3: 'Great' },
    energy: { 1: 'Low', 2: 'Normal', 3: 'High' },
  } as const
  ```

## Dependencies

- [engine-028-readiness-adjuster.md](./spec-readiness.md) — `getReadinessModifier` consumes `sleepQuality` / `energyLevel` from `JITInput`
- [mobile-011-soreness-checkin-screen.md](./mobile-011-soreness-checkin-screen.md) — base screen being extended
- [data-005-cycle-tracking.md](../cycle-tracking/spec-data.md) — `getCurrentCycleContext` source
- [engine-007-jit-session-generator.md](../jit-pipeline/spec-generator.md) — `JITInput` type extended here
