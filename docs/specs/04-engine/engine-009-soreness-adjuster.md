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

- `getSorenessModifier(sorenessLevel: SorenessLevel): SorenessModifier`
  - Returns the adjustment parameters for a given soreness level:

```typescript
interface SorenessModifier {
  setReduction: number       // sets to subtract from planned (0, 1, or 2)
  intensityMultiplier: number // multiplier on %1RM (1.0, 0.95, 0.85, or recovery mode)
  recoveryMode: boolean      // true → override entire session with 40% × 3×5
  warning: string | null     // displayed to user
}
```

| Soreness | Set Reduction | Intensity Multiplier | Recovery Mode | Warning |
|----------|---------------|---------------------|---------------|---------|
| 1        | 0             | 1.00                | false         | null |
| 2        | 0             | 1.00                | false         | null |
| 3        | 1             | 1.00                | false         | "Moderate soreness — reduced 1 set" |
| 4        | 2             | 0.95                | false         | "High soreness — reduced volume and intensity 5%" |
| 5        | 0             | 0.00                | true          | "Severe soreness — recovery session only (40% × 3×5)" |

- `applySorenessToSets(plannedSets: PlannedSet[], modifier: SorenessModifier, minSets?: number): PlannedSet[]`
  - If `recoveryMode: true`: replace all sets with 3 sets at 40% of the original weight, 5 reps, RPE 5.0
  - Otherwise:
    - Remove `setReduction` sets from the end of the set list (min `minSets`, default 1)
    - Multiply each set's `weight_kg` by `intensityMultiplier`, then re-round to nearest 2.5kg

- `getPrimaryMusclesForSession(lift: Lift): MuscleGroup[]`
  - Returns the primary muscles to check soreness for before this session type:
  - `squat`: `['quads', 'glutes', 'lower_back']`
  - `bench`: `['chest', 'triceps', 'shoulders']`
  - `deadlift`: `['hamstrings', 'glutes', 'lower_back', 'upper_back']`

- `getWorstSoreness(muscles: MuscleGroup[], ratings: Record<MuscleGroup, SorenessLevel>): SorenessLevel`
  - Returns the maximum soreness rating across the primary muscles for this session
  - The worst muscle drives the adjustment for the entire session

**Unit tests (`packages/training-engine/__tests__/soreness-adjuster.test.ts`):**
- Soreness 1 → modifier: `{ setReduction: 0, intensityMultiplier: 1.0, recoveryMode: false }`
- Soreness 3 → planned 2 sets → returns 1 set
- Soreness 4 → planned 2 sets at 112.5kg → returns 0 sets (2 - 2 = 0 → clamped to min 1 set) at 107.5kg (112.5 × 0.95 = 106.875 → round to 107.5)
- Soreness 5 → returns 3 × 5 at 40% of original weight regardless of original plan
- `getWorstSoreness({ quads: 2, glutes: 4, lower_back: 1 })` → 4
- `getPrimaryMusclesForSession('bench')` → `['chest', 'triceps', 'shoulders']`

## Dependencies

- [engine-006-mrv-mev-calculator.md](./engine-006-mrv-mev-calculator.md)
- [engine-003-loading-percentage-calculator.md](./engine-003-loading-percentage-calculator.md)
