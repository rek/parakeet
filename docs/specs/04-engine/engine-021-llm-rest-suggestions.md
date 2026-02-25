# Spec: LLM Rest Suggestion Integration

**Status**: Planned
**Domain**: Training Engine

## What This Covers

Extends the LLM JIT prompt to optionally return per-set rest suggestions. The LLM suggestion is advisory and constrained to ±60s of the formula default. Only active when the LLM JIT strategy is selected.

## Tasks

### JITAdjustment Extension

**File: `packages/training-engine/src/generator/jit-session-generator.ts`**

Add to `JITAdjustment`:
```typescript
restAdjustments?: {
  mainLift?: number    // delta seconds from formula default, constrained to [-60, +60]
  // Per-set rest not supported — one adjustment applies to all main sets in this session
}
```

### LLM Prompt Update

**File: `packages/training-engine/src/generator/llm-jit-generator.ts`**

Add to the LLM context JSON:
```json
{
  "formulaRestSeconds": 300,
  "lastSetRpe": 9.6,
  "sessionFatigueContext": "block3_heavy_active_disruption"
}
```

Add to the LLM output schema:
```json
{
  "restAdjustmentSeconds": 60
}
```

System prompt addition (append to existing prompt):
```
Optionally include "restAdjustmentSeconds": a delta in seconds from the formula default.
Must be between -60 and +60. Omit if the formula default is appropriate.
Only suggest a larger rest if RPE was very high (≥9.5) or disruption/soreness is significant.
Only suggest shorter rest if this is a deload or RPE was notably low (≤7.5).
```

**Constraint enforcement (post-LLM, before returning JITOutput):**
```typescript
const rawDelta = adjustment.restAdjustments?.mainLift ?? 0
const clampedDelta = Math.max(-60, Math.min(60, rawDelta))
const formulaBase = getFormulaRest(input)
restRecommendations.mainLift = mainLiftSets.map(() => formulaBase + clampedDelta)
```

Hard constraint: if clamping changes the value, log a warning (LLM exceeded allowed range).

### Display Flag

The `JITOutput` gains an optional field:
```typescript
llmRestSuggestion?: {
  deltaSeconds: number         // the clamped delta that was applied
  formulaBaseSeconds: number   // what the formula would have been
}
```

This is read by the mobile rest timer UI (see [mobile-017-rest-timer.md](../09-mobile/mobile-017-rest-timer.md)) to decide whether to show the "AI suggested X min" chip.

The chip is shown when `Math.abs(llmRestSuggestion.deltaSeconds) >= 30`.

### Unit Tests

**File: `packages/training-engine/src/generator/__tests__/llm-jit-generator.test.ts`** — add cases:
- [ ] LLM returns `restAdjustmentSeconds: 60` → clamped to 60, added to formula base
- [ ] LLM returns `restAdjustmentSeconds: 90` → clamped to 60 (warn logged)
- [ ] LLM returns `restAdjustmentSeconds: -30` → formula base − 30
- [ ] LLM omits field → formula base unchanged, `llmRestSuggestion` is undefined
- [ ] LLM parse error → formula strategy fallback, no rest suggestion

## Dependencies

- [engine-020-rest-config.md](./engine-020-rest-config.md) — formula base rest values
- [engine-011-llm-jit-generator.md](./engine-011-llm-jit-generator.md) — LLM strategy, JITAdjustment type, fallback behaviour
