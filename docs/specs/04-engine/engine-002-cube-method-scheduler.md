# Spec: Cube Method Scheduler

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

The rotation table and scheduling logic that determines which intensity type (Heavy / Explosive / Rep) each lift gets in each week of the program.

## Tasks

**File: `packages/training-engine/src/cube/scheduler.ts`**

- [x] Define `CUBE_ROTATION` constant:
  ```
  Week 1 in block: Squat=Heavy,     Bench=Rep,       Deadlift=Explosive
  Week 2 in block: Squat=Explosive, Bench=Heavy,     Deadlift=Rep
  Week 3 in block: Squat=Rep,       Bench=Explosive, Deadlift=Heavy
  ```
- [x] `getIntensityTypeForWeek(weekNumber: number, lift: Lift): IntensityType`
  - Maps week number (1-9) to block (1-3) and week-in-block (1-3)
  - Returns intensity type from `CUBE_ROTATION`
  - Week 10: returns `'deload'` for all lifts
- [x] `getBlockNumber(weekNumber: number): 1 | 2 | 3`
  - `Math.floor((weekNumber - 1) / 3) + 1`
- [x] `getWeekInBlock(weekNumber: number): 1 | 2 | 3`
  - `((weekNumber - 1) % 3) + 1`
- [x] `isDeloadWeek(weekNumber: number, totalWeeks: number): boolean`
  - Returns true when `weekNumber === totalWeeks`

**File: `packages/training-engine/src/cube/scheduler.ts` (session date calculation):**

- [x] `calculateSessionDate(startDate: Date, weekNumber: number, dayIndex: number, trainingDaysPerWeek: number): Date`
  - Day spacing: 3 days → [0, 2, 4] offset from Monday; 4 days → [0, 1, 3, 5]; 5 days → [0, 1, 2, 4, 5]
  - Week offset: `(weekNumber - 1) × 7` days
  - Returns new Date (no mutation of startDate)

**Unit tests (`packages/training-engine/__tests__/scheduler.test.ts`):**
- [x] All 9 week/lift combinations produce correct intensity type
- [x] Week 10 returns deload for all lifts
- [x] Block/week-in-block calculations are correct for weeks 1-9
- [x] Session date for week 1 day 1 (3-day program, start Monday) = start date
- [x] Session date for week 2 day 3 = start + 11 days

## Dependencies

- [engine-001-one-rep-max-formulas.md](./engine-001-one-rep-max-formulas.md)
