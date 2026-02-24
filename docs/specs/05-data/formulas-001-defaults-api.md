# Spec: Formula Defaults (Local Constant)

**Status**: Implemented
**Domain**: Formula Management

## What This Covers

The `DEFAULT_FORMULA_CONFIG` constant exported from `packages/training-engine`. This is the canonical Cube Method configuration that user formula overrides are applied against. There is no network call — defaults are a compile-time constant imported directly by the app.

## Tasks

**`packages/training-engine/src/config/default-formula-config.ts`:**
- Export `DEFAULT_FORMULA_CONFIG` constant of type `FormulaConfig`
- This constant is imported by `apps/mobile/lib/formulas.ts` (see `formulas-002-config-api.md`) and merged with any active user override row from Supabase

**Shape:**
```typescript
export const DEFAULT_FORMULA_CONFIG: FormulaConfig = {
  blocks: {
    1: {
      heavy:    { pct: 0.80, sets: 2, reps: 5, rpe_target: 8.5 },
      explosive:{ pct: 0.65, sets: 3, reps: 8, rpe_target: 7.0 },
      rep:      { pct_min: 0.70, pct_max: 0.70, sets_min: 2, sets_max: 3, reps_min: 8, reps_max: 12, rpe_target: 8.0 },
    },
    2: { /* ... */ },
    3: { /* ... */ },
  },
  deload: { pct: 0.40, sets: 3, reps: 5, rpe_target: 5.0 },
  progressive_overload: { heavy_pct_increment_per_block: 0.05 },
  training_max_increase: {
    bench_min_kg: 2.5,  bench_max_kg: 5.0,
    squat_min_kg: 5.0,  squat_max_kg: 10.0,
    deadlift_min_kg: 5.0, deadlift_max_kg: 10.0,
  },
}
```

**Usage in `apps/mobile/lib/formulas.ts`:**

```typescript
import { DEFAULT_FORMULA_CONFIG } from '@parakeet/training-engine'

export async function getFormulaConfig(userId: string): Promise<FormulaConfig> {
  const { data } = await supabase
    .from('formula_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  // If no override row, the default is the user's config
  return data ? mergeFormulaConfig(DEFAULT_FORMULA_CONFIG, data.overrides) : DEFAULT_FORMULA_CONFIG
}
```

No route, no auth, no network call for the defaults themselves.

## Dependencies

- [engine-003-loading-percentage-calculator.md](../04-engine/engine-003-loading-percentage-calculator.md)
- [formulas-002-config-api.md](./formulas-002-config-api.md)
