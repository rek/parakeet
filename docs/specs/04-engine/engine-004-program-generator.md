# Spec: Program Generator (Structural Scaffolding)

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

The `generateProgram` function now creates **structural scaffolding only** — session placeholders with metadata (week, block, lift, intensity type, planned date) but **no `planned_sets`**. Sets are calculated JIT when the user opens the session.

## Tasks

**File: `packages/training-engine/src/generator/program-generator.ts`**

- [x] `generateProgram(input: GenerateProgramInput): GeneratedProgramStructure`
  - Input: `{ totalWeeks: number, trainingDaysPerWeek: number, startDate: Date }`
  - Output: program structure with sessions that have NO `planned_sets`
  - Pure function — deterministic from the same inputs
- [x] `generateWeekSessions(weekNumber, blockNumber, weekInBlock, trainingDaysPerWeek, startDate): SessionScaffold[]`
  - Each session has: `weekNumber`, `dayNumber`, `primaryLift`, `intensityType`, `blockNumber`, `isDeload`, `plannedDate`
  - `plannedSets: null` — explicitly null, not an empty array (signals "not yet JIT-generated")
- [x] `generateDeloadWeek(weekNumber, totalWeeks, trainingDaysPerWeek, startDate): SessionScaffold[]`
  - Same structure, `isDeload: true`, `intensityType: 'deload'`

**Type: `SessionScaffold`**
```typescript
interface SessionScaffold {
  weekNumber: number
  dayNumber: number
  primaryLift: Lift
  intensityType: IntensityType
  blockNumber: 1 | 2 | 3 | null  // null for deload
  isDeload: boolean
  plannedDate: Date
  plannedSets: null  // always null; populated by JIT generator
  jitGeneratedAt: null
}
```

**Auxiliary assignment generation:**
- [x] `generateAuxiliaryAssignments(totalWeeks: number, auxiliaryPool: AuxiliaryPool): AuxiliaryAssignment[]`
  - For each block (1, 2, 3) and each lift (squat, bench, deadlift):
    - Select exercises at pool positions `[(blockIndex × 2) % poolSize, (blockIndex × 2 + 1) % poolSize]`
    - Returns list of `AuxiliaryAssignment` objects to write to DB

**Integration test:**
- [x] 10-week, 3-day program → 30 session scaffolds (3 × 10)
- [x] All `plannedSets` are null
- [x] Week 1 sessions: squat/heavy, bench/rep, deadlift/explosive
- [x] Week 4 sessions: squat/heavy (block 2), bench/rep (block 2), deadlift/explosive (block 2)
- [x] Week 10: all 3 sessions `isDeload: true`

## Dependencies

- [engine-002-cube-method-scheduler.md](./engine-002-cube-method-scheduler.md)
- [engine-003-loading-percentage-calculator.md](./engine-003-loading-percentage-calculator.md)
