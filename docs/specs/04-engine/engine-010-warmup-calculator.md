# Spec: Warmup Calculator

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

Generates a series of progressively heavier warmup sets that ramp up to the working weight for a given session. Warmup sets are computed from the **adjusted** working weight (whatever JIT produced after soreness and MRV checks), so the warmup automatically adapts to the day's actual load.

Four named protocols are built in. Users can also define fully custom step sequences per lift.

## Tasks

**File: `packages/training-engine/src/generator/warmup-calculator.ts`**

**Types:**

```typescript
type WarmupPresetName = 'standard' | 'minimal' | 'extended' | 'empty_bar'

type WarmupProtocol =
  | { type: 'preset'; name: WarmupPresetName }
  | { type: 'custom'; steps: WarmupStep[] }

interface WarmupStep {
  pct: number   // fraction of working weight (0.0–1.0)
  reps: number
}

interface WarmupSet {
  setNumber: number
  weightKg: number        // rounded to nearest 2.5kg, minimum 20kg (empty bar)
  displayWeight: string   // "20 kg (bar)" when at or below 20kg
  reps: number
  isWarmup: true
}
```

**Built-in protocols (% of working weight × reps):**

| Protocol | Steps |
|----------|-------|
| `standard` (default) | 40%×5, 60%×3, 75%×2, 90%×1 |
| `minimal` | 50%×5, 75%×2 |
| `extended` | 30%×10, 50%×5, 65%×3, 80%×2, 90%×1, 95%×1 |
| `empty_bar` | 20kg×10 (fixed), 50%×5, 70%×3, 85%×1 |

`empty_bar` is designed for bench press and overhead press — the first set is always the empty bar regardless of working weight, useful when learning movement patterns before adding load.

**Functions:**

- [x] `generateWarmupSets(workingWeightKg: number, protocol: WarmupProtocol): WarmupSet[]`
  - Resolves protocol to steps
  - For each step: `weight = Math.max(20, roundToNearest(workingWeightKg * step.pct))`
  - Assigns sequential `setNumber` starting at 1
  - Sets `displayWeight` to `"${weight} kg (bar)"` when `weight === 20`, else `"${weight} kg"`
  - Skips any step where the computed weight equals the previous step's weight (deduplication)
- [x] `getPresetSteps(name: WarmupPresetName): WarmupStep[]`
  - Returns the step array for a named preset
- [x] `resolveProtocol(protocol: WarmupProtocol): WarmupStep[]`
  - Resolves both preset and custom protocols to a flat `WarmupStep[]`

**Unit tests (`packages/training-engine/__tests__/warmup-calculator.test.ts`):**
- [x] Working weight 112.5kg, `standard` → [45kg×5, 67.5kg×3, 85kg×2, 102.5kg×1]
- [x] Working weight 60kg, `standard` → [25kg×5, 37.5kg×3, 45kg×2, 55kg×1]
- [x] Working weight 30kg, `standard` → first step `30×0.4=12→20kg`, second `30×0.6=18→20kg`; both map to 20kg so second is deduped out
- [x] `empty_bar`, 100kg → [20kg×10 (bar), 50kg×5, 70kg×3, 85kg×1]
- [x] Custom `[{pct: 0.5, reps: 8}, {pct: 0.75, reps: 3}]`, 100kg → [50kg×8, 75kg×3]
- [x] `minimal`, 80kg → [40kg×5, 60kg×2]

## Dependencies

- [engine-001-one-rep-max-formulas.md](./engine-001-one-rep-max-formulas.md) — reuses `roundToNearest()`
