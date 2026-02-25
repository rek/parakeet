# Spec: Sex-Aware Auxiliary Work Volume

**Status**: Planned
**Domain**: Training Engine

## What This Covers

`buildAuxiliaryWork` gains a `biologicalSex` parameter. Female lifters default to 3×12 (vs 3×10 for males) at the same RPE and relative intensity. This reflects their higher volume tolerance and faster inter-set recovery — adding reps rather than sets keeps session density stable. All existing MRV-cap and soreness-skip logic is unchanged.

## Tasks

**File: `packages/training-engine/src/generator/jit-session-generator.ts`**

- [ ] Update `buildAuxiliaryWork` signature to accept `biologicalSex?: 'female' | 'male'` as final parameter
- [ ] Replace hardcoded `reps: 10` with:
  ```typescript
  const baseReps = biologicalSex === 'female' ? 12 : 10
  ```
  Used in the `PlannedSet` array construction
- [ ] Update the `buildAuxiliaryWork(...)` call site inside `generateJITSession` to pass `input.biologicalSex`
- [ ] Soreness-reduced sets retain the sex-specific base rep count (e.g., female at soreness 3: 2 sets × 12 reps, not 2 × 10)

**Unit tests (`packages/training-engine/src/__tests__/jit-session-generator.test.ts`):**
- [ ] Female input (no soreness): auxiliary sets have `reps: 12`
- [ ] Male input (no soreness): auxiliary sets have `reps: 10`
- [ ] `biologicalSex: undefined`: defaults to `reps: 10`
- [ ] Female input at soreness 3 (−1 set): 2 sets remain, each with `reps: 12`
- [ ] Female input at soreness 4: 2 sets remain (female soreness-4 rule from engine-017), each with `reps: 12`
- [ ] Female input at soreness 5: auxiliary skipped (unchanged)
- [ ] MRV cap logic still skips auxiliary regardless of sex

## Usage Context

- `JITInput.biologicalSex` is already defined as optional — no type changes needed
- Per-exercise overrides in Settings → Auxiliary Exercises (`reps` column) take precedence over this default at the data layer, not here — this function only produces the JIT default
- `jit_strategy: 'llm'` path: LLM JIT generator receives `biologicalSex` in its prompt context already (engine-011); this spec covers the formula path only

## Dependencies

- [engine-007-jit-session-generator.md](./engine-007-jit-session-generator.md) — JIT pipeline
- [engine-008-auxiliary-exercise-rotation.md](./engine-008-auxiliary-exercise-rotation.md) — auxiliary pool
- [engine-017-sex-soreness-adjuster.md](./engine-017-sex-soreness-adjuster.md) — soreness rules applied before rep count selection
- [data-004-athlete-profile.md](../05-data/data-004-athlete-profile.md) — `biological_sex` field
