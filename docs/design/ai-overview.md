# AI Overview

Map of every place AI interacts with Parakeet. Two types of AI: **LLM** (LLM via Vercel AI SDK) and **formula** (deterministic rule-based engine). Disruption adjustment is formula-only; everything else is LLM-optional or LLM-enhanced.

---

## Models & SDK

| Model | Use | Timeout |
|-------|-----|---------|
| `gpt-4o-mini` | JIT session generation, motivational messages | 5s (JIT) / 8s (motivational) → formula fallback |
| `gpt-5` | Cycle review generation | none (async) |

> See `packages/training-engine/src/ai/models.ts` for current config.

- SDK: `@ai-sdk/openai` via Vercel AI SDK (`generateText()` / `Output.object()`)
- Config: `packages/training-engine/src/ai/models.ts`
- Polyfill: `apps/parakeet/src/app/_layout.tsx` → `import 'expo/fetch'`
- API key: `EXPO_PUBLIC_OPENAI_API_KEY` (bundled; ok for 2-user app)

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
- `llm` → `JIT_MODEL` only
- `hybrid` → both in parallel (see §2)

**LLM call:** `generateText()` with `Output.object()` → `JITAdjustmentSchema` (Zod)

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
- `apps/parakeet/src/modules/jit/lib/jit.ts` ← app orchestrator

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

**LLM call:** `generateText()` with `Output.object()` → `CycleReviewSchema` (Zod), no timeout.

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
- `apps/parakeet/src/modules/cycle-review/lib/cycle-review.ts` ← routing + storage
- `apps/parakeet/src/modules/program/application/program.service.ts` ← trigger

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
- `apps/parakeet/src/modules/settings/lib/developer-suggestions.ts`

---

### 7. Motivational Message (post-workout)

**What:** LLM-generated 1-2 sentence motivational message shown on the "Workout Done" card.

**Trigger:** User views the Today tab after completing one or more sessions.

**Input (`MotivationalContext`):**
- `primaryLifts`, `intensityTypes`, `weekNumber`, `blockNumber`, `isDeload`
- `sessionRpe`, `performanceVsPlan` (from `session_logs`)
- `completionPct` — average completion % across sessions (from `session_logs.completion_pct`)
- `topWeightKg` — max `weight_grams / 1000` across all `actual_sets` (lets LLM reference real weights)
- `totalSetsCompleted` — total set count across sessions
- `newPRs` (from `personal_records` with matching `session_id`)
- `currentStreak`, `biologicalSex`, `cyclePhase`

**LLM call:** `generateText()` with `JIT_MODEL` (gpt-4o-mini), plain text output (no schema), 8s timeout.

**Priority rules:** PRs > high RPE (may cite `topWeightKg`) > over-performance > under-performance/low `completionPct` > deload. Secondary: `topWeightKg` for specificity, high `totalSetsCompleted`, streak, cycle phase.

**Caching:** React Query with `staleTime: Infinity` keyed on session IDs — generated once per set of completed sessions.

**Key files:**
- `apps/parakeet/src/modules/session/application/motivational-message.service.ts`
- `apps/parakeet/src/app/(tabs)/today.tsx` — `WorkoutDoneCard` component

---

### 8. Disruption Adjustment (formula-only, not LLM)

**What:** Rule-based session adjustments after athlete reports injury/illness/fatigue.

**Trigger:** User submits disruption report.

**Engine:** `suggestDisruptionAdjustment()` — deterministic, no Claude call.

**But:** `activeDisruptions[]` is passed as context into `JITInput`, so LLM sees them during session generation.

**UI:** `disruption-report/report.tsx` → Review Adjustments step.

**Key files:**
- `packages/training-engine/src/disruption-adjuster.ts`
- `apps/parakeet/src/modules/disruptions/lib/disruptions.ts`
- `apps/parakeet/src/app/disruption-report/report.tsx`

---

### 9. Sex & Cycle Context (passthrough to LLM)

**What:** Biological sex and menstrual cycle phase are surfaced to LLM as context; they also drive formula defaults.

**How it enters the AI pipeline:**
- `biologicalSex` + `userAge` in `JITInput` → sent to `JIT_MODEL` in JIT prompt
- `menstrualCycleInsights` in `CycleReviewSchema` → `CYCLE_REVIEW_MODEL` uses phase data if provided
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

### 10. Post-Hoc Review Judge (Challenge Mode)

**What:** Async LLM review of formula JIT output. Fires after JIT persists, surfaces concerns during warmup.

**Trigger:** After `runJITForSession()` persists to DB — fire-and-forget.

**Input:** Full `JITInput` + `JITOutput` (formula's decision + rationale).

**LLM call:** `generateText()` with `Output.object()` → `JudgeReviewSchema` (Zod), `JIT_MODEL`, 8s timeout.

**Output (`JudgeReview`):**
- `score` (0–100)
- `verdict`: `accept` | `flag`
- `concerns`: max 3 specific issues
- `suggestedOverrides`: optional partial adjustments

**Stored:** `challenge_reviews` table.

**UI:** If `verdict === 'flag'`: amber banner on session screen with first concern. Tap to expand. Dismiss button.

**Failure mode:** On error returns silent pass (score 100, accept). Does not block session.

**Key files:**
- `packages/training-engine/src/review/judge-reviewer.ts`
- `apps/parakeet/src/modules/jit/lib/jit.ts` ← fire-and-forget caller
- `apps/parakeet/src/app/(tabs)/session/[sessionId].tsx` ← banner UI

---

### 11. Decision Replay Scoring (Challenge Mode)

**What:** Async LLM scoring after session completion. Compares prescribed vs actual outcomes.

**Trigger:** After `completeSession()` — fire-and-forget.

**Input:** `jit_input_snapshot` + `planned_sets` (from session) + `actual_sets`, `auxiliary_sets`, `session_rpe` (from session_logs).

**LLM call:** `generateText()` with `Output.object()` → `DecisionReplaySchema` (Zod), `JIT_MODEL`, 10s timeout.

**Output (`DecisionReplay`):**
- `prescriptionScore` (0–100)
- `rpeAccuracy` (0–100)
- `volumeAppropriateness`: `too_much` | `right` | `too_little`
- `insights`: max 5 actionable observations

**Stored:** `decision_replay_logs` table.

**UI:** Dashboard only — no in-app surface. Trend charts, per-lift breakdowns.

**Failure mode:** Silently swallowed. Does not block session completion.

**Key files:**
- `packages/training-engine/src/review/decision-replay.ts`
- `apps/parakeet/src/modules/session/application/decision-replay.service.ts` ← app orchestrator
- `apps/parakeet/src/modules/session/application/session.service.ts` ← fire-and-forget caller

---

## Prompts & Constraints

**`packages/training-engine/src/ai/prompts.ts`**
- `JIT_SYSTEM_PROMPT` — expert coach; precedence: disruptions > soreness > RPE
- `CYCLE_REVIEW_SYSTEM_PROMPT` — multi-dimensional analysis (lift-by-lift, aux, volume, formula, structural)
- `JUDGE_REVIEW_SYSTEM_PROMPT` — expert coach reviewing generated session; double-penalty detection, aux conflicts, rest checks
- `DECISION_REPLAY_SYSTEM_PROMPT` — sports scientist scoring prescription accuracy; RPE deviation thresholds, volume appropriateness

**`packages/training-engine/src/ai/constraints.ts`**
- `JIT_INTENSITY_MIN/MAX` = 0.40 / 1.20
- `JIT_SET_DELTA_MIN/MAX` = -3 / +2
- `JIT_RATIONALE_MAX_ITEMS` = 5, `JIT_RATIONALE_MAX_CHARS` = 200

---

## Schema Validation (Zod)

All LLM outputs validated before use:
- `JITAdjustmentSchema` → `packages/shared-types/src/jit.schema.ts`
- `CycleReviewSchema` → `packages/shared-types/src/cycle-review.schema.ts`
- `JudgeReviewSchema` → `packages/shared-types/src/challenge.schema.ts`
- `DecisionReplaySchema` → `packages/shared-types/src/challenge.schema.ts`

Parse failure → formula fallback (JIT) or caught error (cycle review).
