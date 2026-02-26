# Spec: Hybrid JIT Generator

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

`HybridJITGenerator` — runs Formula and LLM strategies in parallel, compares outputs, and surfaces divergences to the user for developer review. Includes the `jit_comparison_logs` Supabase table and developer mode strategy selector UI.

## Tasks

### HybridJITGenerator

**File: `packages/training-engine/src/generator/hybrid-jit-generator.ts`**

```typescript
export class HybridJITGenerator implements JITGeneratorStrategy {
  readonly name = 'hybrid'
  readonly description = 'Runs formula and LLM in parallel; compares outputs'

  constructor(
    private formula: FormulaJITGenerator,
    private llm: LLMJITGenerator,
  ) {}

  async generate(input: JITInput): Promise<JITOutput> {
    const [formulaResult, llmResult] = await Promise.allSettled([
      this.formula.generate(input),
      this.llm.generate(input),
    ])

    const formulaOutput = formulaResult.status === 'fulfilled' ? formulaResult.value : null
    const llmOutput    = llmResult.status    === 'fulfilled' ? llmResult.value    : null

    // If LLM failed, fall back to formula (same as LLMJITGenerator fallback behaviour)
    if (!llmOutput) {
      return { ...formulaOutput!, jit_strategy: 'formula_fallback' }
    }

    const divergence = computeDivergence(formulaOutput!, llmOutput)

    // Log comparison regardless of divergence level
    void logComparison(input, formulaOutput!, llmOutput, divergence)

    if (divergence.weightPct <= 0.10 && divergence.setDelta === 0) {
      // Agree within 10% weight + same set count → use LLM (better rationale)
      return { ...llmOutput, jit_strategy: 'llm', comparisonData: { divergence, formulaOutput } }
    }

    // Diverge → return LLM output but attach comparison for UI display
    return {
      ...llmOutput,
      jit_strategy: 'llm',
      comparisonData: {
        divergence,
        formulaOutput,
        shouldSurfaceToUser: divergence.weightPct > 0.15 || divergence.setDelta !== 0,
      },
    }
  }
}

interface DivergenceResult {
  weightPct: number       // |llmWeight - formulaWeight| / formulaWeight
  setDelta: number        // llmSets - formulaSets (signed)
  rpeContextSummary: string
}

function computeDivergence(formula: JITOutput, llm: JITOutput): DivergenceResult {
  const formulaWeight = formula.mainLiftSets[0]?.weightKg ?? 0
  const llmWeight     = llm.mainLiftSets[0]?.weightKg ?? 0
  return {
    weightPct: formulaWeight > 0 ? Math.abs(llmWeight - formulaWeight) / formulaWeight : 0,
    setDelta:  llm.mainLiftSets.length - formula.mainLiftSets.length,
    rpeContextSummary: llm.rationale?.[0] ?? '',
  }
}
```

**`JITOutput` extension (add to type in `jit-session-generator.ts`):**
```typescript
comparisonData?: {
  divergence: DivergenceResult
  formulaOutput: JITOutput
  shouldSurfaceToUser: boolean
}
```

---

### jit_comparison_logs Table

Add to migration:
```sql
CREATE TABLE jit_comparison_logs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES profiles(id),
  session_id      uuid REFERENCES sessions(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  jit_input       jsonb NOT NULL,
  formula_output  jsonb NOT NULL,
  llm_output      jsonb NOT NULL,
  divergence      jsonb NOT NULL,
  strategy_used   text NOT NULL   -- 'llm' | 'formula_fallback'
);

-- 90-day retention: run via Supabase scheduled function or cron
-- DELETE FROM jit_comparison_logs WHERE created_at < now() - INTERVAL '90 days';
```

**`logComparison()` in `packages/training-engine/src/generator/hybrid-jit-generator.ts`:**
```typescript
async function logComparison(
  input: JITInput,
  formula: JITOutput,
  llm: JITOutput,
  divergence: DivergenceResult,
): Promise<void> {
  // Fire-and-forget — comparison logging must not block JIT output
  supabase.from('jit_comparison_logs').insert({
    user_id: input.userId,
    session_id: input.sessionId,
    jit_input: input,
    formula_output: formula,
    llm_output: llm,
    divergence,
    strategy_used: llm ? 'llm' : 'formula_fallback',
  }).then()  // intentionally not awaited
}
```

---

### Developer Mode Strategy Selector

**`apps/parakeet/app/settings/developer.tsx`** — extend existing developer settings screen:

Add a "JIT Strategy" section:
```
JIT Strategy
────────────────────────────────
● Auto  (LLM if online, formula if offline)
○ Formula only
○ LLM only
○ Hybrid  (show comparison in session)
```

Selection persisted to Async Storage:
```typescript
// apps/parakeet/src/lib/settings.ts
const JIT_STRATEGY_KEY = 'jit_strategy_override'
type JITStrategyOverride = 'auto' | 'formula' | 'llm' | 'hybrid'
```

Read by `JITGeneratorRegistry` before generating each session:
```typescript
// packages/training-engine/src/generator/jit-generator-registry.ts
const override = await getJITStrategyOverride()
const strategy = resolveStrategy(override, isOnline)
return registry.get(strategy).generate(input)
```

---

### Divergence Display in Session Screen

When `comparisonData.shouldSurfaceToUser === true`, the session screen (`[sessionId].tsx`) renders a `<ComparisonCard>` above the set list:

```
┌──────────────────────────────────────┐
│  Formula: 2 × 107.5 kg              │
│  AI:      1 × 95 kg                 │
│  Using AI suggestion.  [Use formula] │
│                                      │
│  "Minor knee injury + late luteal    │
│   phase + 11 days since last session │
│   → compound signal" (AI rationale)  │
└──────────────────────────────────────┘
```

"Use formula" button swaps the session to the formula output (writes `jit_strategy: 'formula_override'` to the session row).

---

### Unit Tests

**File: `packages/training-engine/src/generator/__tests__/hybrid-jit-generator.test.ts`:**
- [x] Both agree within 10% + same sets → LLM output returned
- [x] Diverge > 15% weight → `shouldSurfaceToUser: true` in comparisonData
- [x] LLM fails → formula output returned with `jit_strategy: 'formula_fallback'`
- [x] Formula fails → should not happen (formula is always local); test that error propagates

## Dependencies

- [engine-007-jit-session-generator.md](./engine-007-jit-session-generator.md) — JITGeneratorStrategy, JITGeneratorRegistry
- [engine-011-llm-jit-generator.md](./engine-011-llm-jit-generator.md) — LLMJITGenerator
- [mobile-005-session-logging-screen.md](../09-mobile/mobile-005-session-logging-screen.md) — ComparisonCard rendered here
