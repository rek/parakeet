# Spec: Rest Time Formula Config & JIT Integration

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

Adds `rest_seconds` to `FormulaConfig`, defines sex-differentiated defaults, and wires the JIT generator to populate `restRecommendations` on `JITOutput`.

## Tasks

### FormulaConfig Extension

**File: `packages/training-engine/src/cube/blocks.ts`**

Add `rest_seconds` to the `FormulaConfig` type:

```typescript
interface FormulaRestSeconds {
  block1: { heavy: number; explosive: number; rep: number }
  block2: { heavy: number; explosive: number; rep: number }
  block3: { heavy: number; explosive: number; rep: number }
  deload: number
  auxiliary: number   // fixed for all aux work
}
```

Add to `FormulaConfig`:
```typescript
rest_seconds: FormulaRestSeconds
```

**Default constants:**

```typescript
export const DEFAULT_REST_SECONDS_MALE: FormulaRestSeconds = {
  block1: { heavy: 180, explosive: 120, rep: 120 },
  block2: { heavy: 210, explosive: 150, rep: 120 },
  block3: { heavy: 300, explosive: 180, rep: 150 },
  deload:  90,
  auxiliary: 90,
}

export const DEFAULT_REST_SECONDS_FEMALE: FormulaRestSeconds = {
  block1: { heavy: 150, explosive: 90,  rep: 90  },
  block2: { heavy: 180, explosive: 120, rep: 90  },
  block3: { heavy: 270, explosive: 150, rep: 120 },
  deload:  90,
  auxiliary: 90,
}
```

Female values = male values − 30s on all non-deload entries (faster inter-set recovery; see [sex-based-adaptations.md](../../design/sex-based-adaptations.md)). Deload and auxiliary unchanged.

`DEFAULT_FORMULA_CONFIG_MALE` and `DEFAULT_FORMULA_CONFIG_FEMALE` each gain `rest_seconds` using their respective constant. `getDefaultFormulaConfig(biologicalSex?)` returns the correct config (already handles sex selection — just add the field).

---

### JITOutput Extension

**File: `packages/training-engine/src/generator/jit-session-generator.ts`**

Add to `JITOutput`:
```typescript
restRecommendations: {
  mainLift: number[]    // rest_after_seconds for each main working set (by index)
  auxiliary: number[]   // one value per auxiliary exercise (always 90s unless overridden)
}
```

Rest is on `JITOutput`, not on `PlannedSet`, to keep the planned-set DB schema unchanged.

**Formula strategy — populating `restRecommendations`:**
- For each main lift set: look up `formulaConfig.rest_seconds[blockKey][intensityType]`
- `blockKey` derived from `blockNumber` (`block1` | `block2` | `block3`)
- All sets in the session get the same rest value (rest is intensity-type-level, not set-level for the formula path)
- Auxiliary: always `formulaConfig.rest_seconds.auxiliary` (90s)
- If user has an entry in `rest_configs` for this lift + intensity type (passed in via `JITInput`): use user override instead of formula default

**JITInput extension:**
```typescript
userRestOverrides?: Array<{
  lift?: Lift             // null = applies to all
  intensityType?: IntensityType  // null = all
  restSeconds: number
}>
```

---

### Unit Tests

**File: `packages/training-engine/src/generator/jit-session-generator.test.ts`** — add cases:
- [x] Block 3 Heavy, male defaults → `restRecommendations.mainLift` all 300
- [x] Block 2 Rep, female defaults → `restRecommendations.mainLift` all 90
- [x] User override present for squat heavy → override value used instead of formula default
- [x] Auxiliary always 90 regardless of block or sex
- [x] Deload session → deload rest (90)

## Dependencies

- [engine-007-jit-session-generator.md](./engine-007-jit-session-generator.md) — JITInput/JITOutput types
- [engine-015-sex-formula-config.md](./engine-015-sex-formula-config.md) — sex-differentiated FormulaConfig pattern
- [data-006-rest-config.md](../05-data/data-006-rest-config.md) — user overrides sourced here
