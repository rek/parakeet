# Spec: Soreness Adjuster

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

Translates pre-workout muscle soreness ratings (1–5) into concrete volume and intensity modifications for the JIT session generator. Soreness is the first gate — it runs before MRV/MEV checks.

## Tasks

**File: `packages/training-engine/src/adjustments/soreness-adjuster.ts`**

**Type: `SorenessLevel`**
```typescript
type SorenessLevel = 1 | 2 | 3 | 4 | 5
// 1: Fresh       — no soreness
// 2: Mild        — slight tightness, no impact
// 3: Moderate    — noticeable, some movement restriction
// 4: High        — significant discomfort or limited range
// 5: Severe      — should not train this muscle
```

- [x] `getSorenessModifier(sorenessLevel: SorenessLevel): SorenessModifier`
  - Returns the adjustment parameters for a given soreness level:

```typescript
interface SorenessModifier {
  setReduction: number       // sets to subtract from planned (0, 1, or 2)
  intensityMultiplier: number // multiplier on %1RM (1.0, 0.95, 0.85, or recovery mode)
  recoveryMode: boolean      // true → override entire session with 40% × 3×5
  warning: string | null     // displayed to user
}
```

See [domain/adjustments.md](../../domain/adjustments.md) for the soreness modifier table (levels 1–5: set reduction, intensity multiplier, recovery mode, warning text).

- [x] `applySorenessToSets(plannedSets: PlannedSet[], modifier: SorenessModifier, minSets?: number): PlannedSet[]`
  - If `recoveryMode: true`: replace all sets with 3 sets at 40% of the original weight, 5 reps, RPE 5.0
  - Otherwise: remove `setReduction` sets from the end (min `minSets`, default 1), multiply each `weight_kg` by `intensityMultiplier`, re-round to nearest 2.5kg
- [x] `getPrimaryMusclesForSession(lift: Lift): MuscleGroup[]`
  - `squat`: `['quads', 'glutes', 'lower_back']`
  - `bench`: `['chest', 'triceps', 'shoulders']`
  - `deadlift`: `['hamstrings', 'glutes', 'lower_back', 'upper_back']`
- [x] `getWorstSoreness(muscles: MuscleGroup[], ratings: Record<MuscleGroup, SorenessLevel>): SorenessLevel`
  - Returns the maximum soreness rating across the primary muscles for this session

**Unit tests (`packages/training-engine/__tests__/soreness-adjuster.test.ts`):**
- [x] Soreness 1 → modifier: `{ setReduction: 0, intensityMultiplier: 1.0, recoveryMode: false }`
- [x] Soreness 3 → planned 2 sets → returns 1 set
- [x] Soreness 4 → planned 2 sets at 112.5kg → returns 0 sets (2 - 2 = 0 → clamped to min 1 set) at 107.5kg (112.5 × 0.95 = 106.875 → round to 107.5)
- [x] Soreness 5 → returns 3 × 5 at 40% of original weight regardless of original plan
- [x] `getWorstSoreness({ quads: 2, glutes: 4, lower_back: 1 })` → 4
- [x] `getPrimaryMusclesForSession('bench')` → `['chest', 'triceps', 'shoulders']`

## Dependencies

- [engine-006-mrv-mev-calculator.md](./engine-006-mrv-mev-calculator.md)
- [engine-003-loading-percentage-calculator.md](./engine-003-loading-percentage-calculator.md)

## Domain References

- [domain/adjustments.md](../../domain/adjustments.md) — soreness modifier table (set reduction, intensity multiplier, recovery mode by level)
