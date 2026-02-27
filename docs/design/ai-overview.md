# AI Overview

Map of every place AI interacts with Parakeet. Two types of AI: **LLM** (Claude via Vercel AI SDK) and **formula** (deterministic rule-based engine). Disruption adjustment is formula-only; everything else is LLM-optional or LLM-enhanced.

---

## Models & SDK

| Model | Use | Timeout |
|-------|-----|---------|
| `claude-haiku-4-5` | JIT session generation | 5s → formula fallback |
| `claude-sonnet-4-6` | Cycle review generation | none (async) |

- SDK: `@ai-sdk/anthropic` via Vercel AI SDK (`generateObject()`)
- Config: `packages/training-engine/src/ai/models.ts`
- Polyfill: `apps/parakeet/src/app/_layout.tsx` → `import 'expo/fetch'`
- API key: `EXPO_PUBLIC_ANTHROPIC_API_KEY` (bundled; ok for 2-user app)

---

## AI Interaction Points

### 1. JIT Session Generation

**What:** Per-session, on-demand. Adjusts planned sets based on current athlete state.

**Trigger:** User opens today's session after soreness check-in.

**Input (`JITInput`):**
- `oneRmKg`, `formulaConfig`, `sorenessRatings`
- `weeklyVolumeToDate`, `mrvMevConfig`
- `activeDisruptions`, `recentSessions`
- `biologicalSex`, `userAge`
- `auxiliaryAssignments`, `warmupConfig`

**Strategy (user-selectable):**
- `auto` → LLM if online, formula if offline
- `formula` → deterministic, always offline-capable
- `llm` → Claude Haiku only
- `hybrid` → both in parallel (see §2)

**LLM call:** `generateObject()` → `JITAdjustmentSchema` (Zod)

**Output:**
- `intensityModifier` (0.40–1.20 × formula weight)
- `setModifier` (-3 to +2 sets)
- `skipMainLift`, `auxOverrides`
- `restAdjustments` (±60s per lift — see §3)
- `rationale` (≤5 items, ≤200 chars each)

**Fallback:** formula on timeout (5s) or parse error.

**Stored:** `sessions.planned_sets`, `jit_strategy`, `jit_input_snapshot`, `jit_generated_at`

**Key files:**
- `packages/training-engine/src/generator/llm-jit-generator.ts`
- `packages/training-engine/src/generator/formula-jit-generator.ts`
- `packages/training-engine/src/generator/jit-registry.ts`
- `apps/parakeet/src/lib/jit.ts` ← app orchestrator

---

### 2. Hybrid JIT Comparison

**What:** Runs formula + LLM in parallel; logs divergence for data quality feedback.

**Trigger:** JIT strategy = `hybrid`.

**Logic:**
- `Promise.allSettled([formula, llm])`
- Divergence: weight diff >10% OR setDelta ≠ 0
- Returns LLM output + `comparisonData` if divergence detected
- Falls back to formula if LLM fails

**Stored:** `jit_comparison_logs` table (90-day retention)

**UI:** `settings/developer.tsx` → JIT Strategy selector

**Key files:**
- `packages/training-engine/src/generator/hybrid-jit-generator.ts`
- `apps/parakeet/src/app/settings/developer.tsx`

---

### 3. LLM Rest Suggestions

**What:** LLM proposes per-lift rest delta vs formula base, inside the JIT pipeline.

**Trigger:** Same as JIT (part of `JITAdjustment`).

**Constraints:** ±60s from formula default.

**Stored:** `JITOutput.llmRestSuggestion` (deltaSeconds, rationale)

**UI:** `RestTimer` component in session screen shows delta.

**Key files:**
- `packages/training-engine/src/ai/constraints.ts`
- `apps/parakeet/src/app/session/[sessionId].tsx`

---

### 4. Cycle Review Generation

**What:** End-of-cycle LLM analysis. Produces narrative + actionable suggestions.

**Trigger:** Program reaches ≥80% completion → `onCycleComplete()` fires async (fire-and-forget).

**Input:**
- `CycleReport` (sessions, RPE trends, volume, aux correlations, disruptions, formula changes)
- `PreviousCycleSummaries[]` (multi-cycle context via engine-025)
- Menstrual phase overlay (if cycle tracking enabled)

**LLM call:** `generateObject()` → `CycleReviewSchema` (Zod), no timeout.

**Output fields:**
| Field | Description | Routed to |
|-------|-------------|-----------|
| `overallAssessment` | Narrative cycle summary | cycle review UI |
| `progressByLift` | Rating + narrative per lift | cycle review UI |
| `auxiliaryInsights` | Correlation rankings + recommendations | cycle review UI |
| `formulaSuggestions` | Suggested formula overrides w/ rationale | `formula_configs` (source='ai_suggestion') |
| `structuralSuggestions` | Higher-level strategic observations | `developer_suggestions` table |
| `nextCycleRecommendations` | Narrative for next block | cycle review UI |
| `menstrualCycleInsights` | Phase-aware performance patterns | cycle review UI (females only) |

**Failure mode:** Caught + logged; does not block cycle completion.

**Key files:**
- `packages/training-engine/src/review/cycle-review-generator.ts`
- `packages/training-engine/src/review/assemble-cycle-report.ts`
- `apps/parakeet/src/lib/cycle-review.ts` ← routing + storage
- `apps/parakeet/src/services/program.service.ts` ← trigger

---

### 5. Formula Suggestions (cycle review output)

**What:** AI-proposed formula parameter changes (load %, set counts, rest, etc.)

**Source:** `formulaSuggestions` from cycle review.

**Stored:** `formula_configs` table — `is_active=false`, `source='ai_suggestion'`, `ai_rationale` text.

**UI:**
- `formula/editor.tsx` → "AI Suggestions" tab — Accept / Dismiss
- `(tabs)/settings.tsx` → badge with pending count

**Key files:**
- `apps/parakeet/src/app/formula/editor.tsx`
- `apps/parakeet/src/app/(tabs)/settings.tsx`

---

### 6. Developer / Structural Suggestions (cycle review output)

**What:** High-level strategic observations that require code changes, not just config.

**Source:** `structuralSuggestions` from cycle review.

**Stored:** `developer_suggestions` table — priority (high/medium/low), status (unreviewed/acknowledged/implemented/dismissed).

**UI:**
- `settings/developer.tsx` → Cycle Feedback section with priority badges
- `(tabs)/settings.tsx` → badge with unreviewed count

**Key files:**
- `apps/parakeet/src/app/settings/developer.tsx`
- `apps/parakeet/src/lib/developer-suggestions.ts`

---

### 7. Disruption Adjustment (formula-only, not LLM)

**What:** Rule-based session adjustments after athlete reports injury/illness/fatigue.

**Trigger:** User submits disruption report.

**Engine:** `suggestDisruptionAdjustment()` — deterministic, no Claude call.

**But:** `activeDisruptions[]` is passed as context into `JITInput`, so LLM sees them during session generation.

**UI:** `disruption-report/report.tsx` → Review Adjustments step.

**Key files:**
- `packages/training-engine/src/disruption-adjuster.ts`
- `apps/parakeet/src/lib/disruptions.ts`
- `apps/parakeet/src/app/disruption-report/report.tsx`

---

### 8. Sex & Cycle Context (passthrough to LLM)

**What:** Biological sex and menstrual cycle phase are surfaced to LLM as context; they also drive formula defaults.

**How it enters the AI pipeline:**
- `biologicalSex` + `userAge` in `JITInput` → sent to Haiku in JIT prompt
- `menstrualCycleInsights` in `CycleReviewSchema` → Sonnet uses phase data if provided
- `session_logs.cycle_phase` stamped at session completion

**Formula-level effects (not LLM):**
- `DEFAULT_MRV_MEV_CONFIG_MALE/FEMALE`
- `DEFAULT_REST_SECONDS_MALE/FEMALE`
- `DEFAULT_THRESHOLDS_FEMALE`
- `standard_female` warmup preset

**UI surface:**
- Today screen: cycle phase pill + ovulatory guidance chip
- Disruption report: menstrual symptoms option (female only)

---

## Prompts & Constraints

**`packages/training-engine/src/ai/prompts.ts`**
- `JIT_SYSTEM_PROMPT` — expert coach; precedence: disruptions > soreness > RPE
- `CYCLE_REVIEW_SYSTEM_PROMPT` — multi-dimensional analysis (lift-by-lift, aux, volume, formula, structural)

**`packages/training-engine/src/ai/constraints.ts`**
- `JIT_INTENSITY_MIN/MAX` = 0.40 / 1.20
- `JIT_SET_DELTA_MIN/MAX` = -3 / +2
- `JIT_RATIONALE_MAX_ITEMS` = 5, `JIT_RATIONALE_MAX_CHARS` = 200

---

## Schema Validation (Zod)

All LLM outputs validated before use:
- `JITAdjustmentSchema` → `packages/shared-types/src/jit.schema.ts`
- `CycleReviewSchema` → `packages/shared-types/src/cycle-review.schema.ts`

Parse failure → formula fallback (JIT) or caught error (cycle review).
