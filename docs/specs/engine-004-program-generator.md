# Spec: Program Generator (Orchestrator)

**Status**: Planned
**Domain**: Training Engine

## What This Covers

The top-level `generateProgram` function that orchestrates all engine components into a complete, deterministic 10-week Cube Method program.

## Tasks

**File: `packages/training-engine/src/generator/program-generator.ts`**

- `generateProgram(input: GenerateProgramInput): GeneratedProgram`
  - Input: `{ maxes: LiftMaxes, formulaConfig: FormulaConfig, totalWeeks: number, trainingDaysPerWeek: number, startDate: Date }`
  - Validates input (throws `ProgramGenerationError` for invalid values)
  - Iterates weeks 1 → totalWeeks:
    - Last week: calls `generateDeloadWeek()`
    - Other weeks: calls `generateWeekSessions()` for each lift/day
  - Returns complete `GeneratedProgram` with all weeks and sessions
  - Must be a pure function — no side effects, no async operations

- `generateWeekSessions(params): Session[]`
  - Resolves intensity type per lift from `CUBE_ROTATION` via scheduler
  - Maps `trainingDaysPerWeek` to lift order: 3=[squat, bench, dl], 4=[squat, bench, dl, squat], 5=[squat, bench, dl, squat, bench]
  - Calls `calculateSets()` for each session
  - Calls `calculateSessionDate()` for each session

- `generateDeloadWeek(weekNumber: number, maxes: LiftMaxes): Week`
  - 40% of 1RM, 3×5 for all three lifts
  - Marks all sessions with `isDeload: true`

**File: `packages/training-engine/src/generator/program-generator.ts` (validation):**
- `validateProgramInput(input): void`
  - All 1RM values must be positive numbers
  - `totalWeeks` must be 6-16
  - `trainingDaysPerWeek` must be 3-5
  - `startDate` must not be in the past (warn, not error)

**Integration test (`packages/training-engine/__tests__/generator.test.ts`):**
- Generate full 10-week program (Squat 315, Bench 225, DL 365, 3 days/week)
- Assert week 1 session 1: squat heavy, 252.5 lbs × 2×5
- Assert week 4 session 1: squat heavy, 267.5 lbs × 2×3 (block 2 progression)
- Assert week 10: all sessions isDeload=true, weights ~40% of 1RM
- Assert total session count: 10 weeks × 3 days = 30 sessions (minus deload = 27 regular + 3 deload)
- Snapshot test: full program JSON matches expected output (deterministic)

## Dependencies

- [engine-002-cube-method-scheduler.md](./engine-002-cube-method-scheduler.md)
- [engine-003-loading-percentage-calculator.md](./engine-003-loading-percentage-calculator.md)
