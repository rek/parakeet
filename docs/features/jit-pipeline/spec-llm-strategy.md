# Spec: LLM JIT Generator (v1.6)

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

`LLMJITGenerator` — the second `JITGeneratorStrategy` implementation. Replaces the rule-based adjuster with holistic LLM reasoning. Receives the full `JITInput`, calls `generateText` with `Output.object`, applies the typed `JITAdjustment` to the formula base, enforces hard constraints, and appends volume top-up exercises. Internally retries once and silently falls back to `FormulaJITGenerator` on persistent failure.

See `../core-engine/design-architecture.md` for the full architecture and the rationale for the pluggable strategy design.

## Tasks

### JITAdjustment Schema

**`packages/shared-types/src/jit.schema.ts`:**
- [x] Define and export `AuxOverrideSchema` and `JITAdjustmentSchema`:
  ```typescript
  // OpenAI Responses API (strict JSON-Schema mode) rejects `propertyNames`
  // (which `z.record(z.string(), …)` produces). Use an explicit array shape.
  export const AuxOverrideSchema = z.object({
    exercise: z.string(),
    action: z.enum(['skip', 'reduce', 'normal']),
  });

  // Strict mode also requires every property in `properties` to appear in
  // `required`. Use `.nullable()` rather than `.optional()` for fields the
  // model may omit — model emits `null` instead of dropping the key.
  export const JITAdjustmentSchema = z.object({
    intensityModifier: z.number().min(0.40).max(1.20),
    setModifier: z.number().int().min(-3).max(2),
    skipMainLift: z.boolean(),
    auxOverrides: z.array(AuxOverrideSchema),
    rationale: z.array(z.string().max(200)).max(5),
    confidence: z.enum(['high', 'medium', 'low']),
    restAdjustments: z
      .object({ mainLift: z.number().nullable() })
      .nullable(),
  })
  export type JITAdjustment = z.infer<typeof JITAdjustmentSchema>
  ```

### LLMJITGenerator Implementation

**`packages/training-engine/src/generator/llm-jit-generator.ts`:**
- [x] Implement `LLMJITGenerator` class implementing `JITGeneratorStrategy`
  - `name = 'llm' as const`
  - Calls `generateText` with `Output.object({ schema: JITAdjustmentSchema })` and `abortAfter(12000)` per attempt
  - **Two attempts** before falling back. Cold-start of the Supabase Edge proxy plus auth + rate-limit DB calls regularly consumed the original 5s budget; bumped to 12s × 2 retries (engine-046).
  - On success: applies adjustment via `applyAdjustment()` then `enforceHardConstraints()`, returns `jit_strategy: 'llm'`
  - On any error (timeout, network, Zod parse): reports via `reportEngineError` (Sentry breadcrumb + captureException) **on every failed attempt**, then falls back to `FormulaJITGenerator`, returns `jit_strategy: 'formula_fallback'`
  - Empty `catch {}` is forbidden — see `feedback_always_capture_exceptions`. The retry loop must surface every failure, not just the last.
- [x] `buildJITContext(input: JITInput)` — omits `warmupConfig` from context sent to LLM (warmup is always formula-generated via `resolveEffectiveWarmupProtocol()`, never LLM-adjusted; same override logic as formula path)
- [x] `applyAdjustment` calls `buildVolumeTopUp` (engine-027 / gh#203) after building auxiliaryWork, capped at `MAX_AUX_EXERCISES` (5). Volume top-up is a hard constraint — when a muscle is below MEV, an exercise is appended; when core is below MEV one slot is reserved for it (no compound contributes to core). The LLM only adjusts the configured aux pair; it cannot bypass the top-up rule. See [`../volume/spec-augmentation.md`](../volume/spec-augmentation.md).
- [x] `applyAdjustment` reads `restAdjustments` and `restAdjustments.mainLift` with `!= null` checks (nullable schema, not optional).
- [x] (landed) **Clarify the contract between `llmRestSuggestion` and `restRecommendations.mainLift`.** Today the LLM rest delta is *both* written into every per-set `restRecommendations.mainLift` entry AND surfaced as a separate `llmRestSuggestion` string. The mobile rest timer consumes `restRecommendations`, so the delta is silently applied; the "AI suggested X min" chip then describes "what we did" instead of being an opt-in proposal. Either treat the chip as advisory + revert per-set rest to the formula default until accepted, or remove the chip and document that LLM rest is always applied. (Per-set rest is positional in `restRecommendations.mainLift` — intra-session add-backs will misalign indices; consider storing rest on each `PlannedSet` instead.)

### Integration with JITGeneratorRegistry

**`packages/training-engine/src/generator/jit-registry.ts`:**
- [x] `getJITGenerator(strategy: JITStrategyName, isOnline: boolean)` — returns appropriate generator
  - `'formula'` → `FormulaJITGenerator`
  - `'llm'` → `LLMJITGenerator`
  - `'hybrid'` → stub (v2)
  - `'auto'` (default): LLM if online, Formula if offline

### Session Row Updates

- [x] Confirm `jit_strategy` column is present in `sessions` table (already in infra-005 schema):
  ```sql
  jit_strategy TEXT  -- 'formula' | 'llm' | 'hybrid' | 'formula_fallback'
  ```
- [x] Write `jit_strategy` to session row alongside `jit_generated_at` and `jit_input_snapshot` after JIT runs

### AI Proxy Path Handling

**`supabase/functions/ai-proxy/index.ts`:**
- [x] Strip whichever prefix the Supabase Edge runtime presents:
  ```ts
  const pathAfterProxy = url.pathname
    .replace(/^\/functions\/v1\/ai-proxy/, '')
    .replace(/^\/ai-proxy/, '');
  ```
  Inside the function, `url.pathname` arrives as `/ai-proxy/<rest>` (function-name prefix only); the older `/functions/v1/ai-proxy/<rest>` form is also accepted for completeness.
- [x] Always forward to OpenAI under `/v1/<path>`. AI SDK v6 (Responses API) calls `${baseURL}/responses`, so the proxy must prefix `/v1/` when missing.
- [x] Log `[ai-proxy] OpenAI returned <status> for <url> :: <body slice>` on any non-2xx response. Required for debugging strict-schema rejections; bodies are OpenAI error envelopes, not user prompt content.
- [x] Module-level singleton Supabase clients (no per-request `createClient`) to shave ~200ms cold-start overhead.

### Engine Error Reporter

**`packages/training-engine/src/ai/error-reporter.ts`:**
- [x] Engine packages cannot import the app's Sentry helper directly. The app calls `configureEngineErrorReporter(...)` at bootstrap, and the engine forwards every caught error via `reportEngineError(err, ctx)`. `LLMJITGenerator`, `JudgeReviewer`, `CalibrationReviewer`, and the Hybrid logger path all use it.

### Unit Tests

**`packages/training-engine/src/generator/__tests__/llm-jit-generator.test.ts`:**
- [x] Valid LLM response → adjustment applied correctly to base weight
- [x] Timeout → fallback to formula, `jit_strategy === 'formula_fallback'`
- [x] Zod parse failure (intensityModifier=0.10, below 0.40 floor) → fallback to formula
- [x] Hard constraint: skipMainLift false but MRV already at cap → override to skip
- [x] Volume top-up: core below MEV → core exercise appended via `applyAdjustment` (gh#203 LLM-path coverage)

## Dependencies

- [engine-007-jit-session-generator.md](./engine-007-jit-session-generator.md)
- [engine-003-loading-percentage-calculator.md](./engine-003-loading-percentage-calculator.md)
- [engine-006-mrv-mev-calculator.md](./engine-006-mrv-mev-calculator.md)
- [ai-001-vercel-ai-sdk-setup.md](../ai/spec-sdk-setup.md)
- [docs/decisions/007-vercel-ai-sdk.md](../../decisions/007-vercel-ai-sdk.md)
