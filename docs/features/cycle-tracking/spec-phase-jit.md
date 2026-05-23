# Spec: Cycle Phase JIT Adjuster

**Status**: Draft
**Domain**: Training Engine

## What This Covers

Adds a `getCyclePhaseModifier` function that returns intensity and volume adjustments based on menstrual cycle phase. Wired into the JIT pipeline as Step 2.5 (between RPE adjustment and soreness adjustment). Only activates when cycle tracking is enabled.

## Tasks

### CyclePhaseModifier type and function

**File: `packages/training-engine/src/adjustments/cycle-phase-adjuster.ts`**

```typescript
import { CyclePhase } from '../formulas/cycle-phase'

export interface CyclePhaseModifier {
  intensityMultiplier: number
  volumeModifier: number      // applied to set count: negative = reduce
  rationale: string | null
}
```

Function: `getCyclePhaseModifier(phase: CyclePhase): CyclePhaseModifier`

Lookup table:

| Phase | intensityMultiplier | volumeModifier | rationale |
|-------|--------------------:|---------------:|-----------|
| menstrual | 0.95 | -1 | "Menstrual phase — intensity −5%, −1 set" |
| follicular | 1.0 | 0 | null |
| ovulatory | 1.0 | 0 | null |
| luteal | 0.975 | 0 | "Luteal phase — intensity −2.5%" |
| late_luteal | 0.95 | -1 | "Late luteal phase — intensity −5%, −1 set" |

Evidence basis: McNulty et al. (2020) meta-analysis shows small but meaningful performance decrements in early follicular (menstrual) and late luteal phases. RP Strength recommends reducing volume/intensity during these phases for female athletes.

### JITInput extension

**File: `packages/training-engine/src/generator/jit-session-generator.ts`**

Add to `JITInput`:
```typescript
cyclePhase?: CyclePhase    // from formulas/cycle-phase.ts
```

Import `CyclePhase` from `'../formulas/cycle-phase'` and `getCyclePhaseModifier` from `'../adjustments/cycle-phase-adjuster'`.

In `generateJITSession`, after Step 2b (readiness adjustment) and before Step 3 (soreness), add:

```typescript
// Step 2c — Cycle phase adjustment
if (input.cyclePhase) {
  const cycleMod = getCyclePhaseModifier(input.cyclePhase)
  intensityMultiplier *= cycleMod.intensityMultiplier
  plannedCount = Math.max(1, plannedCount + cycleMod.volumeModifier)
  if (cycleMod.rationale) rationale.push(cycleMod.rationale)
}
```

### Export

**File: `packages/training-engine/src/index.ts`**

Add `export * from './adjustments/cycle-phase-adjuster'`.

### Tests

**File: `packages/training-engine/src/adjustments/__tests__/cycle-phase-adjuster.test.ts`**

Test cases:
- menstrual → intensity 0.95, volume -1, rationale present
- follicular → neutral (1.0, 0, null)
- ovulatory → neutral
- luteal → intensity 0.975, volume 0, rationale present
- late_luteal → intensity 0.95, volume -1, rationale present

## Open Issues (2026-05 review)

- [ ] **Stale cycle data still gets stamped.** `getCurrentCycleContext` returns a phase based on `(now - last_period_start) mod cycle_length_days` with no upper bound. If a user logged a period six months ago and never updated, the engine will keep stamping a phase derived from the abandoned data and attribute training adjustments to "menstrual" or "luteal" with full confidence. Add a guard in `getCurrentCycleContext`: when `now - last_period_start > 2 * cycle_length_days`, return `null` (no phase). Surface a "Cycle data may be outdated — log a recent period" prompt on the settings cycle row.
- [ ] **`updateSessionCyclePhase` writes to `session_logs.session_id` — never fires for offline completions.** `complete.tsx:360` calls `stampCyclePhaseOnSession` after `completeSession`, but the offline-queued completion path returns early (line 341-345). The session is eventually flushed by the sync queue with no phase. Include `cycle_phase` in the offline `complete_session` payload, or compute it server-side in a trigger reading `cycle_tracking.last_period_start`.

## Domain References

- [domain/adjustments.md](../../domain/adjustments.md) — cycle phase modifier table and research basis (McNulty 2020)
- [domain/sex-differences.md](../../domain/sex-differences.md) — menstrual cycle phase definitions
