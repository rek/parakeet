# Spec: Menstrual Cycle Phase Calculator

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

Pure function that estimates current menstrual cycle phase from the date of the last period start and the user's average cycle length. No side effects, no DB access — this is a calculation-only utility consumed by the mobile app and by engine-011 (LLM JIT generator) for coaching context.

## Tasks

**File: `packages/training-engine/src/formulas/cycle-phase.ts`**

- [ ] Export `CyclePhase` type:
  ```typescript
  export type CyclePhase =
    | 'menstrual'    // days 1–5
    | 'follicular'   // days 6–11
    | 'ovulatory'    // days 12–16
    | 'luteal'       // days 17–23
    | 'late_luteal'  // days 24–cycleLength
  ```
- [ ] Export `CycleContext` interface:
  ```typescript
  export interface CycleContext {
    phase: CyclePhase
    dayOfCycle: number       // 1-indexed; wraps at cycleLength
    daysUntilNextPeriod: number
    isOvulatoryWindow: boolean   // days 12–16 (high injury risk)
    isLateLuteal: boolean        // days 24–cycleLength (disruption routing)
  }
  ```
- [ ] `computeCyclePhase(lastPeriodStart: Date, cycleLength?: number, referenceDate?: Date): CycleContext`
  - `cycleLength` defaults to 28; `referenceDate` defaults to `new Date()`
  - Day-of-cycle: `daysSincePeriodStart = floor((referenceDate - lastPeriodStart) / msPerDay)`, then `dayOfCycle = (daysSincePeriodStart % cycleLength) + 1`
  - For non-28-day cycles, scale linearly: `scaledDay = Math.round(day * 28 / cycleLength)` before applying boundaries

**Unit tests (`packages/training-engine/__tests__/cycle-phase.test.ts`):**
- [ ] Day 1 (same day as period start) → `menstrual`, dayOfCycle: 1
- [ ] Day 5 → `menstrual`
- [ ] Day 6 → `follicular`
- [ ] Day 12 → `ovulatory`, isOvulatoryWindow: true
- [ ] Day 16 → `ovulatory`, isOvulatoryWindow: true
- [ ] Day 17 → `luteal`, isOvulatoryWindow: false
- [ ] Day 24 → `late_luteal`, isLateLuteal: true
- [ ] Day 29 (cycle wraps at 28) → `menstrual` (day 1 of next cycle)
- [ ] 35-day cycle, day 17 → scaled to ~14 → `ovulatory`

**Export from `packages/training-engine/src/index.ts`:**
- [ ] Add exports:
  ```typescript
  export { computeCyclePhase } from './formulas/cycle-phase'
  export type { CyclePhase, CycleContext } from './formulas/cycle-phase'
  ```

## Usage Context

- `apps/parakeet/src/hooks/useCyclePhase.ts` — React Query hook that calls this with stored config
- Today screen: phase indicator pill ("Follicular · Day 9")
- Today screen: ovulatory info chip on squat-heavy sessions (isOvulatoryWindow)
- JIT generator context (engine-011): passes `cycleContext` for LLM coaching notes
- Disruption routing: isLateLuteal triggers "consider reporting as disruption" suggestion

## Dependencies

- [data-005-cycle-tracking.md](../05-data/data-005-cycle-tracking.md) — provides `lastPeriodStart` + `cycleLength`
