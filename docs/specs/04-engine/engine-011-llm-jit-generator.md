# Spec: LLM JIT Generator (v1.5)

**Status**: Planned
**Domain**: Training Engine

## What This Covers

`LLMJITGenerator` — the second `JITGeneratorStrategy` implementation. Replaces the rule-based adjuster with holistic LLM reasoning. Receives the full `JITInput`, calls `generateObject()` to get a typed `JITAdjustment`, applies it to the formula base, and enforces hard constraints. Falls back to `FormulaJITGenerator` on timeout or parse error.

See `docs/design/training-engine-architecture.md` for the full architecture and the rationale for the pluggable strategy design.

## Tasks

### JITAdjustment Schema

**`packages/shared-types/src/jit.schema.ts`:**
- [ ] Define and export `JITAdjustmentSchema`:
  ```typescript
  export const JITAdjustmentSchema = z.object({
    intensityModifier: z.number().min(0.40).max(1.20),
    setModifier: z.number().int().min(-3).max(2),
    skipMainLift: z.boolean(),
    auxOverrides: z.record(z.enum(['skip', 'reduce', 'normal'])),
    rationale: z.array(z.string().max(200)).max(5),
    confidence: z.enum(['high', 'medium', 'low']),
  })
  export type JITAdjustment = z.infer<typeof JITAdjustmentSchema>
  ```

### LLMJITGenerator Implementation

**`packages/training-engine/src/generator/llm-jit-generator.ts`:**
- [ ] Implement `LLMJITGenerator` class implementing `JITGeneratorStrategy`
  - `name = 'llm' as const`
  - Calls `generateObject()` with 5000ms `AbortSignal.timeout`
  - On success: applies adjustment via `applyAdjustment()` then `enforceHardConstraints()`
  - On any error (timeout, network, Zod parse): falls back to `FormulaJITGenerator`, returns `jit_strategy: 'formula_fallback'`
- [ ] `buildJITContext(input: JITInput)` — omits `warmupConfig` from context sent to LLM

### Integration with JITGeneratorRegistry

**`packages/training-engine/src/generator/jit-registry.ts`:**
- [ ] `getJITGenerator(strategy: JITStrategyName, isOnline: boolean)` — returns appropriate generator
  - `'formula'` → `FormulaJITGenerator`
  - `'llm'` → `LLMJITGenerator`
  - `'hybrid'` → `HybridJITGenerator`
  - `'auto'` (default): LLM if online, Formula if offline

### Session Row Updates

- [ ] Confirm `jit_strategy` column is present in `sessions` table (already in infra-005 schema):
  ```sql
  jit_strategy TEXT  -- 'formula' | 'llm' | 'hybrid' | 'formula_fallback'
  ```
- [ ] Write `jit_strategy` to session row alongside `jit_generated_at` and `jit_input_snapshot` after JIT runs

### Unit Tests

**`packages/training-engine/src/generator/__tests__/llm-jit-generator.test.ts`:**
- [ ] Valid LLM response → adjustment applied correctly to base weight
- [ ] Timeout → fallback to formula, `jit_strategy === 'formula_fallback'`
- [ ] Zod parse failure (intensityModifier=0.10, below 0.40 floor) → fallback to formula
- [ ] Hard constraint: skipMainLift false but MRV already at cap → override to skip

## Dependencies

- [engine-007-jit-session-generator.md](./engine-007-jit-session-generator.md)
- [engine-003-loading-percentage-calculator.md](./engine-003-loading-percentage-calculator.md)
- [engine-006-mrv-mev-calculator.md](./engine-006-mrv-mev-calculator.md)
- [ai-001-vercel-ai-sdk-setup.md](../10-ai/ai-001-vercel-ai-sdk-setup.md)
- [docs/decisions/007-vercel-ai-sdk.md](../../decisions/007-vercel-ai-sdk.md)
