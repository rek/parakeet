# Spec: Dynamic Intensity Selection for Unending Programs

**Feature:** programs  
**Status:** planned  
**Issue:** #188

## Context

Unending programs generate one session at a time in
`packages/training-engine/src/generator/program-generator.ts:nextUnendingSession()`.
The intensity type (`heavy` / `explosive` / `rep` / `deload`) is currently derived
from `weekNumber % 3` via the CUBE rotation matrix in `cube/scheduler.ts`. In
unending mode, `weekNumber` is a counter-derived value with no calendar meaning —
so the rotation can silently repeat the same type back-to-back, and it ignores
what the lifter actually needs.

The fix: replace the CUBE lookup for unending programs with signal-driven
selection. Scheduled programs are unchanged.

---

## Selection Logic

Evaluated in strict priority order. First matching rule wins.

| Priority | Condition | Result |
|----------|-----------|--------|
| 1 | Deload week: `weekNumber % 4 === 0` | `'deload'` |
| 2 | Max soreness across primary muscles ≥ 7 | `'rep'` |
| 3 | Days since last session for this lift ≥ 10 | `'heavy'` |
| 4 | Avg RPE of last 3 sessions for this lift ≥ 8.5 | `'explosive'` |
| 5 | Would repeat last intensity type | next in `heavy → explosive → rep → heavy` |
| 6 | Default | `'heavy'` |

**Null/missing signal treatment:**

- `primaryMuscleSoreness: null` → soreness rule does not fire
- `daysSinceLastSession: null` → long-gap rule does not fire
- `recentRpe: []` → RPE rule does not fire
- `lastIntensityType: null` → repeat-prevention rule does not fire

**Deload note:** `selectIntensityTypeForUnending` handles deload as priority 1,
so the `isDeload` guard in `nextUnendingSession` is subsumed when signals are
present. Keep it for the CUBE fallback path (backwards-compat for tests without
signals).

Threshold source of truth: `docs/domain/periodization.md` §"Unending Intensity Selection".

---

## Signals

All already in DB. No schema changes.

| Signal | Existing function | Location |
|--------|-------------------|----------|
| Soreness per muscle | `getLatestSorenessRatings(userId)` | `session.repository.ts:287` |
| Days since last session for lift | `fetchLastCompletedAtForLift(userId, lift)` | `session.repository.ts:587` |
| Recent RPE + last intensity type | `getRecentLogsForLift(userId, lift, 3)` | `session.service.ts:564` (private) |

Primary muscles per lift (source: `soreness-adjuster.ts:111`):
- `squat` → `['quads', 'glutes', 'lower_back']`
- `bench` → `['chest', 'triceps', 'shoulders']`
- `deadlift` → `['hamstrings', 'glutes', 'lower_back', 'upper_back']`

Use the already-exported helpers `getPrimaryMusclesForSession(lift)` and
`getWorstSoreness(muscles, ratings)` from `@parakeet/training-engine`
(re-exported through `adjustments/soreness-adjuster.ts`).

---

## Implementation Tasks

### Phase 1 — Training Engine

**1.1** Add `IntensityTypeSignals` interface and `selectIntensityTypeForUnending`
function to `packages/training-engine/src/cube/scheduler.ts`.

```typescript
// Add after the CUBE_ROTATION constant (line 11)

export interface IntensityTypeSignals {
  primaryMuscleSoreness: number | null;
  daysSinceLastSession: number | null;
  recentRpe: number[];                   // RPEs for last ≤3 sessions, empty = no data
  lastIntensityType: IntensityType | null;
}

const INTENSITY_ROTATION: IntensityType[] = ['heavy', 'explosive', 'rep'];

export function selectIntensityTypeForUnending(
  lift: Lift,
  weekNumber: number,
  signals: IntensityTypeSignals
): IntensityType {
  const { primaryMuscleSoreness, daysSinceLastSession, recentRpe, lastIntensityType } = signals;

  // 1. Deload
  if (weekNumber % 4 === 0) return 'deload';

  // 2. High soreness → rep
  if (primaryMuscleSoreness !== null && primaryMuscleSoreness >= 7) return 'rep';

  // 3. Long gap → heavy
  if (daysSinceLastSession !== null && daysSinceLastSession >= 10) return 'heavy';

  // 4. Accumulated fatigue → explosive
  const rpeValues = recentRpe.filter((r): r is number => r != null);
  if (rpeValues.length > 0) {
    const avg = rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length;
    if (avg >= 8.5) return 'explosive';
  }

  // 5. Avoid repeat
  if (lastIntensityType !== null && lastIntensityType !== 'deload') {
    const idx = INTENSITY_ROTATION.indexOf(lastIntensityType);
    if (idx !== -1) return INTENSITY_ROTATION[(idx + 1) % INTENSITY_ROTATION.length];
  }

  // 6. Default
  return 'heavy';
}
```

**1.2** Add `computeNextUnendingLift` to
`packages/training-engine/src/generator/program-generator.ts`.

This extracts the lift-derivation logic (currently private inside
`nextUnendingSession`) so the app layer can compute the next lift before
fetching lift-specific signals, without duplicating the formula.

```typescript
// Add after nextLiftAfter() (line 129), before nextUnendingSession()

export function computeNextUnendingLift(input: {
  sessionCounter: number;
  trainingDaysPerWeek: number;
  lastCompletedLift?: Lift | null;
}): Lift {
  const { sessionCounter, trainingDaysPerWeek, lastCompletedLift } = input;
  const daysPerWeek = Math.max(1, trainingDaysPerWeek);
  return lastCompletedLift
    ? nextLiftAfter(lastCompletedLift)
    : LIFTS[(sessionCounter % daysPerWeek) % LIFTS.length];
}
```

**1.3** Extend `NextUnendingSessionInput` (line 108) and update the intensity
derivation inside `nextUnendingSession()` (lines 151-153).

```typescript
// Updated interface
export interface NextUnendingSessionInput {
  sessionCounter: number;
  trainingDaysPerWeek: number;
  lastCompletedLift?: Lift | null;
  intensitySignals?: IntensityTypeSignals;   // NEW — triggers dynamic selection
}

// Updated intensity derivation (replaces lines 151-153)
const intensityType: IntensityType = input.intensitySignals
  ? selectIntensityTypeForUnending(lift, weekNumber, input.intensitySignals)
  : isDeload
    ? 'deload'
    : getIntensityTypeForWeek(weekNumber, lift);
```

The CUBE fallback (`isDeload ? 'deload' : getIntensityTypeForWeek(...)`) is
preserved for backwards compatibility — all existing tests pass unchanged.

**1.4** Export new symbols from
`packages/training-engine/src/modules/program-generation/index.ts`.

```typescript
// Add to existing exports
export { computeNextUnendingLift } from '../../generator/program-generator';
export type { IntensityTypeSignals } from '../../cube/scheduler';
export { selectIntensityTypeForUnending } from '../../cube/scheduler';
```

**1.5** Tests: add a new describe block to
`packages/training-engine/src/generator/program-generator.test.ts` for
`selectIntensityTypeForUnending`. Cover every priority branch:

```typescript
describe('selectIntensityTypeForUnending', () => {
  const noSignals: IntensityTypeSignals = {
    primaryMuscleSoreness: null,
    daysSinceLastSession: null,
    recentRpe: [],
    lastIntensityType: null,
  };

  // Rule 1
  it('deload week overrides all other signals', () => {
    expect(
      selectIntensityTypeForUnending('squat', 4, {
        ...noSignals,
        primaryMuscleSoreness: 9,
        daysSinceLastSession: 14,
      })
    ).toBe('deload');
  });

  // Rule 2
  it('soreness >= 7 → rep', () => {
    expect(
      selectIntensityTypeForUnending('squat', 1, { ...noSignals, primaryMuscleSoreness: 7 })
    ).toBe('rep');
    expect(
      selectIntensityTypeForUnending('squat', 1, { ...noSignals, primaryMuscleSoreness: 6 })
    ).not.toBe('rep'); // below threshold
  });

  // Rule 3
  it('days >= 10 → heavy', () => {
    expect(
      selectIntensityTypeForUnending('bench', 1, { ...noSignals, daysSinceLastSession: 10 })
    ).toBe('heavy');
  });

  // Rule 4
  it('avg RPE >= 8.5 → explosive', () => {
    expect(
      selectIntensityTypeForUnending('deadlift', 1, { ...noSignals, recentRpe: [9, 8, 9] })
    ).toBe('explosive');
    expect(
      selectIntensityTypeForUnending('deadlift', 1, { ...noSignals, recentRpe: [8, 8, 8] })
    ).not.toBe('explosive');
  });

  // Rule 5 — repeat prevention
  it('avoids repeating last intensity type', () => {
    expect(
      selectIntensityTypeForUnending('squat', 1, { ...noSignals, lastIntensityType: 'heavy' })
    ).toBe('explosive');
    expect(
      selectIntensityTypeForUnending('squat', 1, { ...noSignals, lastIntensityType: 'explosive' })
    ).toBe('rep');
    expect(
      selectIntensityTypeForUnending('squat', 1, { ...noSignals, lastIntensityType: 'rep' })
    ).toBe('heavy');
  });

  // Rule 5 — deload as lastIntensityType is ignored
  it('lastIntensityType=deload treated as null (no repeat guard)', () => {
    expect(
      selectIntensityTypeForUnending('squat', 1, { ...noSignals, lastIntensityType: 'deload' })
    ).toBe('heavy'); // falls through to default
  });

  // Rule 6
  it('default with no signals → heavy', () => {
    expect(selectIntensityTypeForUnending('squat', 1, noSignals)).toBe('heavy');
  });

  // Null safety
  it('null soreness does not trigger rule 2', () => {
    expect(
      selectIntensityTypeForUnending('squat', 1, { ...noSignals, primaryMuscleSoreness: null })
    ).toBe('heavy');
  });
  it('empty recentRpe does not trigger rule 4', () => {
    expect(
      selectIntensityTypeForUnending('squat', 1, { ...noSignals, recentRpe: [] })
    ).toBe('heavy');
  });
});
```

---

### Phase 2 — Data Layer

**2.1** Extend `appendNextUnendingSession` signature in
`apps/parakeet/src/modules/program/application/unending-session.ts`.

```typescript
// Add IntensityTypeSignals import
import { nextUnendingSession, type IntensityTypeSignals } from '@parakeet/training-engine';

// Updated signature (add intensitySignals as last optional param)
export async function appendNextUnendingSession(
  program: UnendingProgramRef,
  userId: string,
  plannedDate: string,
  lastCompletedLift?: Lift | null,
  intensitySignals?: IntensityTypeSignals
): Promise<void> {
  const next = nextUnendingSession({
    sessionCounter: program.unending_session_counter,
    trainingDaysPerWeek: program.training_days_per_week,
    lastCompletedLift,
    intensitySignals,           // NEW — passed through to engine
  });
  // ... rest unchanged ...
}
```

---

### Phase 3 — App Wiring

**3.1** Update `generateNextUnendingSession` in
`apps/parakeet/src/modules/session/application/session.service.ts` (lines 501–547).

Add to the `@parakeet/training-engine` import block:
```typescript
import {
  // ... existing imports ...
  computeNextUnendingLift,
  getPrimaryMusclesForSession,
  getWorstSoreness,
  type IntensityTypeSignals,
  type SorenessLevel,
} from '@parakeet/training-engine';
import type { MuscleGroup } from '@parakeet/shared-types';
```

Replace `generateNextUnendingSession` body (after `plannedDate` is computed,
before the `try` block):

```typescript
const lastCompletedLift = await fetchLastCompletedLiftForProgram(program.id, userId);

// Determine which lift comes next so we can fetch lift-specific signals.
const nextLift = computeNextUnendingLift({
  sessionCounter: program.unending_session_counter,
  trainingDaysPerWeek: program.training_days_per_week,
  lastCompletedLift,
});

// Fetch signals in parallel — all are independent of each other.
const [sorenessRatings, lastCompletedAt, recentLogs] = await Promise.all([
  getLatestSorenessRatings(userId),
  fetchLastCompletedAtForLift(userId, nextLift),
  getRecentLogsForLift(userId, nextLift, 3),
]);

const primaryMuscleSoreness: number | null = sorenessRatings
  ? getWorstSoreness(
      getPrimaryMusclesForSession(nextLift),
      sorenessRatings as Partial<Record<MuscleGroup, SorenessLevel>>
    )
  : null;

const daysSinceLastSession: number | null = lastCompletedAt?.completed_at
  ? Math.floor(
      (Date.now() - new Date(lastCompletedAt.completed_at).getTime()) / 86_400_000
    )
  : null;

const intensitySignals: IntensityTypeSignals = {
  primaryMuscleSoreness,
  daysSinceLastSession,
  recentRpe: recentLogs
    .map((l) => l.actual_rpe)
    .filter((r): r is number => r !== null),
  lastIntensityType: recentLogs[0]?.intensity_type ?? null,
};

try {
  await appendNextUnendingSession(
    program,
    userId,
    plannedDate,
    lastCompletedLift,
    intensitySignals,          // NEW
  );
} catch (err: unknown) {
  // ... existing 23505 unique-constraint guard unchanged ...
}
return fetchPlannedSessionForProgram(program.id, userId);
```

**3.2** Verify with `/verify` (typecheck, boundaries, tests).

---

### Wrap Up

- [ ] `docs/domain/periodization.md` already updated (thresholds in §"Unending Intensity Selection")
- [ ] `docs/features/programs/design-unending.md` already updated (§"Intensity Selection — Dynamic")
- [ ] Mark this spec `status: done` in `docs/features/programs/index.md`
- [ ] Close GitHub issue #188

---

## Out of Scope

- Scheduled programs: CUBE rotation is unchanged
- UI: intensity badge already shows on the session card; no label change needed
- Retrospective correction of already-generated sessions
- Deload-week detection: `weekNumber % 4 === 0` is unchanged; it fires as priority 1 inside `selectIntensityTypeForUnending`
