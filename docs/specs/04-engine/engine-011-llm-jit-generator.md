# Spec: LLM JIT Generator (v1.5)

**Status**: Planned
**Domain**: Training Engine

## What This Covers

`LLMJITGenerator` — the second `JITGeneratorStrategy` implementation. Replaces the rule-based adjuster with holistic LLM reasoning. Receives the full `JITInput`, calls `generateObject()` to get a typed `JITAdjustment`, applies it to the formula base, and enforces hard constraints. Falls back to `FormulaJITGenerator` on timeout or parse error.

See `docs/design/training-engine-architecture.md` for the full architecture and the rationale for the pluggable strategy design.

## Tasks

### JITAdjustment Schema

**`packages/shared-types/src/jit.schema.ts`:**

```typescript
import { z } from 'zod'

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

The `min`/`max` bounds serve as LLM hallucination guards. Values outside these ranges indicate a parse or reasoning failure; Zod rejects them and the catch block falls back to formula.

### LLMJITGenerator Implementation

**`packages/training-engine/src/generator/llm-jit-generator.ts`:**

```typescript
import { generateObject } from 'ai'
import { JIT_MODEL, JIT_SYSTEM_PROMPT } from '../ai/prompts'
import { JITAdjustmentSchema } from '@parakeet/shared-types'
import type { JITGeneratorStrategy, JITInput, JITOutput } from './types'
import { FormulaJITGenerator } from './formula-jit-generator'
import { applyAdjustment, enforceHardConstraints } from './jit-constraints'

export class LLMJITGenerator implements JITGeneratorStrategy {
  readonly name = 'llm' as const
  readonly description = 'LLM-based holistic adjustment (Anthropic Claude)'

  private readonly fallback = new FormulaJITGenerator()

  async generate(input: JITInput): Promise<JITOutput> {
    // Build context: full JITInput minus warmupConfig (not relevant to adjustment)
    const context = buildJITContext(input)

    try {
      const { object: adjustment } = await generateObject({
        model: JIT_MODEL,
        schema: JITAdjustmentSchema,
        system: JIT_SYSTEM_PROMPT,
        prompt: JSON.stringify(context),
        abortSignal: AbortSignal.timeout(5000),
      })

      // Apply LLM adjustment to formula base weights
      const baseOutput = computeFormulaBase(input)
      const adjusted = applyAdjustment(baseOutput, adjustment, input)

      // Enforce hard constraints (MRV cap, weight floor, minimum sets, rounding)
      return enforceHardConstraints(adjusted, input, {
        strategy: 'llm',
        rationale: adjustment.rationale,
        confidence: adjustment.confidence,
      })
    } catch {
      // Timeout, network error, or Zod parse failure — fall back silently
      const formulaOutput = await this.fallback.generate(input)
      return { ...formulaOutput, jit_strategy: 'formula_fallback' }
    }
  }
}

// Build LLM context: omit warmupConfig, include all recovery + volume signals
function buildJITContext(input: JITInput) {
  const { warmupConfig: _omit, ...context } = input
  return context
}
```

### Integration with JITGeneratorRegistry

**`packages/training-engine/src/generator/jit-registry.ts`:**

```typescript
import { FormulaJITGenerator } from './formula-jit-generator'
import { LLMJITGenerator } from './llm-jit-generator'
import { HybridJITGenerator } from './hybrid-jit-generator'
import type { JITStrategyName } from './types'

export function getJITGenerator(strategy: JITStrategyName, isOnline: boolean) {
  if (strategy === 'formula') return new FormulaJITGenerator()
  if (strategy === 'llm') return new LLMJITGenerator()
  if (strategy === 'hybrid') return new HybridJITGenerator()
  // 'auto' (default): LLM if online, Formula if offline
  return isOnline ? new LLMJITGenerator() : new FormulaJITGenerator()
}
```

Strategy setting comes from `apps/parakeet` Settings → Developer → JIT Strategy (default: `'auto'`).

### Session Row Updates

The `sessions` table needs a `jit_strategy` column (already specified in `infra-005`):

```sql
-- Already in infra-005 schema
jit_strategy TEXT  -- 'formula' | 'llm' | 'hybrid' | 'formula_fallback'
```

After JIT runs, `engine-007` writes `jit_strategy` to the session row alongside `jit_generated_at` and `jit_input_snapshot`.

### Unit Tests

**`packages/training-engine/src/generator/__tests__/llm-jit-generator.test.ts`:**

```typescript
// 1. Valid LLM response → adjustment applied correctly
it('applies intensity modifier to base weight', async () => {
  mockGenerateObject.mockResolvedValue({
    object: { intensityModifier: 0.88, setModifier: -1, skipMainLift: false, ... }
  })
  const output = await generator.generate(testInput)
  expect(output.workingSets[0].weightKg).toBeCloseTo(baseWeight * 0.88, 0.1)
  expect(output.jit_strategy).toBe('llm')
})

// 2. Timeout → fallback to formula
it('falls back to formula on timeout', async () => {
  mockGenerateObject.mockRejectedValue(new Error('AbortError'))
  const output = await generator.generate(testInput)
  expect(output.jit_strategy).toBe('formula_fallback')
})

// 3. Zod parse failure (intensityModifier=0.10, below 0.40 floor) → fallback
it('falls back to formula when LLM returns out-of-bounds adjustment', async () => {
  mockGenerateObject.mockResolvedValue({ object: { intensityModifier: 0.10, ... } })
  // Zod schema rejects this → generateObject throws → catch block runs
  const output = await generator.generate(testInput)
  expect(output.jit_strategy).toBe('formula_fallback')
})

// 4. Hard constraint: skipMainLift false but MRV already at cap → override to skip
it('enforces MRV cap regardless of LLM output', async () => {
  const inputAtMrv = { ...testInput, weeklyVolumeToDate: { quads: 20 }, mrvMevConfig: { quads: { mrv: 20 } } }
  mockGenerateObject.mockResolvedValue({ object: { skipMainLift: false, ... } })
  const output = await generator.generate(inputAtMrv)
  expect(output.skipMainLift).toBe(true)
})
```

## Dependencies

- [engine-007-jit-session-generator.md](./engine-007-jit-session-generator.md)
- [engine-003-loading-percentage-calculator.md](./engine-003-loading-percentage-calculator.md)
- [engine-006-mrv-mev-calculator.md](./engine-006-mrv-mev-calculator.md)
- [ai-001-vercel-ai-sdk-setup.md](../10-ai/ai-001-vercel-ai-sdk-setup.md)
- [docs/decisions/007-vercel-ai-sdk.md](../../decisions/007-vercel-ai-sdk.md)
