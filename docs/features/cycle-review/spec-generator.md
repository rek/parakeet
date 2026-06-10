# Spec: Cycle Review Generator (v1.5)

**Status**: Implemented — core flow complete; known limitations documented inline
**Domain**: Training Engine

## What This Covers

`compileCycleReport()` assembles a structured `CycleReport` from Supabase. `generateCycleReview()` sends it to an LLM via `generateObject()` and stores the typed `CycleReview` result. Formula and developer suggestions are routed to their respective destinations automatically.

See `./design.md` for the full feature design and examples.

## Tasks

### CycleReview Schema

**`packages/shared-types/src/cycle-review.schema.ts`:**

- [x] Define and export `CycleReviewSchema` with all fields:
  - `overallAssessment`: string, max 500 chars
  - `progressByLift`: record of squat/bench/deadlift with `rating` (LiftRatingSchema) and `narrative`
  - `auxiliaryInsights`: `mostCorrelated`, `leastEffective`, `recommendedChanges`
  - `volumeInsights`: `musclesUnderRecovered`, `musclesUndertrained`, `frequencyRecommendation`
  - `formulaSuggestions`: array with `description`, `rationale`, `priority` (the `overrides` record was dropped — OpenAI Responses-API strict-schema mode rejects `z.record` (`propertyNames`) and `z.unknown` (no schema). The dashboard renderer never consumed the field; the rationale string carries the actionable content.)
  - `structuralSuggestions`: array with `description`, `rationale`, `developerNote`
  - `nextCycleRecommendations`: string, max 2000 chars
  - `menstrualInsights`: optional string, max 1000 chars
- [x] Export `type CycleReview = z.infer<typeof CycleReviewSchema>`

### CycleReport Compilation

**`apps/parakeet/src/modules/cycle-review/lib/cycle-review.ts`:**

- [x] `compileCycleReport(programId: string, userId: string): Promise<CycleReport>`
  - Parallel Supabase queries for: program, sessions, sessionLogs, sorenessCheckins, lifterMaxes, disruptions, auxiliaryAssignments, formulaHistory
  - Data access should be delegated to typed repository functions in `apps/parakeet/src/modules/cycle-review/data/cycle-review.repository.ts` (no ad-hoc Supabase table access in UI/service/lib consumers).
  - Calls `assembleCycleReport()` from training-engine to transform raw rows into `CycleReport` struct
  - Note: `soreness_checkins` and `disruptions` are queried by `user_id` only (not scoped to program date range), so cross-cycle data may be included.
  - Current schema mapping requirements:
    - `soreness_checkins` source is `ratings` JSON + `recorded_at`; map to engine shape (`muscle_group`, `soreness_level`, `checked_in_at`) at the repository boundary.
    - `lifter_maxes` source is wide columns (`squat_1rm_grams`, `bench_1rm_grams`, `deadlift_1rm_grams`); expand to per-lift rows before passing into `assembleCycleReport()`.
  - Cycle review history uses `cycle_reviews.generated_at` for recency ordering (not `created_at`).

**`packages/training-engine/src/review/assemble-cycle-report.ts`:**

- [x] `assembleCycleReport(rawData): CycleReport`
  - Computes derived metrics: `avgRpeVsTarget`, `mrvPct`, aux exercise → main lift performance mapping

### Cycle Review Generation

**`packages/training-engine/src/review/cycle-review-generator.ts`:**

- [x] `generateCycleReview(cycleReport: CycleReport, previousSummaries: PreviousCycleSummary[]): Promise<CycleReview>`
  - Calls `generateObject()` with `getCycleReviewModel()` and `CYCLE_REVIEW_SYSTEM_PROMPT`
  - No `AbortSignal.timeout()` — runs asynchronously, user notified when done
- [ ] Add `abortSignal: AbortSignal.timeout(120_000)` to the `generateObject()` call — without a timeout the promise can hang indefinitely if the model stalls, silently preventing the cycle review row from ever being inserted

### Storing the Result

**`apps/parakeet/src/modules/cycle-review/lib/cycle-review.ts` (addition):**

- [x] `storeCycleReview(programId, userId, compiledReport, llmResponse): Promise<void>`
  - Inserts `cycle_reviews` row with `compiled_report` and `llm_response` JSONB
  - Routes `formulaSuggestions` → inserts pending `formula_configs` rows (`is_active: false`, `source: 'ai_suggestion'`)
  - Routes `structuralSuggestions` → inserts `developer_suggestions` rows
  - Handle repository query errors explicitly and fail fast; do not silently continue on failed inserts/selects.

### Trigger Flow

**`apps/parakeet/src/modules/program/application/program.service.ts` — cycle completion handler:**

- [x] `onCycleComplete(programId: string, userId: string): void`
  - Triggered when program reaches ≥80% session completion (checked in `completeSession`)
  - Runs `compileCycleReport` → `generateCycleReview` → `storeCycleReview` asynchronously (no await on outer call)
  - Errors caught and logged via `captureException`; LLM failure does not block cycle completion; no row is inserted on failure
  - Note: `getCycleReview()` also triggers generation on-demand when no row exists. If the user opens the cycle review screen before `onCycleComplete` completes, both paths may execute concurrently — `storeCycleReview` will insert a duplicate row. Known race condition with no current guard.
  - Note: The UI must distinguish "no review yet" from "review failed" — these are different states. See mobile-014 for screen-level handling.
- [x] (landed) **Auto-trigger fails when any session is missed or skipped (scheduled programs).** `session.service.ts` only fires `onCycleComplete` when `completed/total === 1.0`. One missed Wednesday in a 30-session program breaks equality and no review is ever generated. `useEndProgram` only passes `triggerCycleReview: isUnending`, so the manual "End Program" path also fails for scheduled users. Fix: compare `(completed + missed + skipped) >= total`, or pass `triggerCycleReview: true` unconditionally from `useEndProgram`. (Real-world walkthrough E, 2026-05.)
- [ ] **Trigger at program-end, not 80%** — the current 80%-completion gate fires while the cycle is still ongoing. For a 10-week (30-session) program, the LLM runs after session 24; sessions 25-30 (including the deload week) are excluded from the review. Because `triggerCycleReview` short-circuits when an existing row is found, the later sessions never contribute. Options:
  - Defer trigger until `completed/total === 1.0` (or until `isDeloadWeek` session completes), OR
  - Allow regeneration once more when program hits 100%; compare to stored review and overwrite if meaningfully different
- [x] (landed) **`triggerCycleReview` leaves the pending row stuck on LLM failure.** `lib/cycle-review.ts:37-58` wraps neither `generateCycleReview` nor `storeCycleReview` in a `try/catch`. On LLM 5xx, abort, or schema rejection the pending row inserted at line 48 stays `pending` forever and the screen polls every 10s indefinitely (retry button appears after 60s; `canRetry` caps at 3 attempts). Fix: catch around the LLM/store call, set `generation_status: 'error'` with `error_message` on the pending row, break the poll, and let the screen show a permanent retry. Note: `markCycleReviewPending` must remain idempotent on the existing row (UPSERT) so the retry path doesn't trip a duplicate.
- [x] (landed) **Realtime subscription listens for INSERT but the completion path is UPDATE.** `cycle-review.repository.ts:13-34` filters `event: 'INSERT'`. Generation flow writes a pending row first (line 62), then `UPDATE … SET generation_status='complete'` at line 296-307. The realtime channel never fires for completion; the screen relies on the 10s polling fallback. Change filter to `event: '*'` and confirm the Supabase publication includes UPDATEs on `cycle_reviews`.
- [x] (landed) **Structural / formula / developer-suggestion inserts are not idempotent.** `storeCycleReview` (`lib/cycle-review.ts:122-130`) loops insert without an `onConflict` constraint. If the outer cycle-review row succeeds but a downstream insert fails, `triggerCycleReview` short-circuits on `existing?.status === 'complete'` and the partial state is never reconciled. Add a unique `(cycle_review_id, suggestion_index)` and make inserts upserts.
- [x] (landed) **`formulaSuggestions` route writes an empty `overrides: {}` payload.** Schema dropped the `overrides` record for OpenAI strict-mode (see CycleReview Schema section above), but the storage path in `lib/cycle-review.ts:113-120` still inserts `formula_configs` rows with `overrides: {}` and the editor screen's Accept button (`formula/editor.tsx:766`) applies that empty payload — silent no-op. Either: (a) render formula suggestions as advisory-only with no Accept affordance and remove the `formula_configs` insert, OR (b) restore a structured `overrides` payload with an open-mode schema and re-wire ingestion end-to-end.
- [ ] **Populate bodyweight and Wilks in `PreviousCycleSummary`** — `getPreviousCycleSummaries` currently calls `extractSummary(report, review, cycleNumber, 0, 0, 0)`, hardcoding `bodyWeightStartKg`, `bodyWeightEndKg`, and `wilksScore` to zero. This makes the multi-cycle LLM context useless for tracking strength progression across cycles. Pull actual values from `bodyweight_entries` and `extractSummary` should receive the real start/end bodyweights and Wilks computed from final maxes.
- [x] (landed) **`compileCycleReport` for unending programs coerces `total_weeks` to 0.** `fetchCycleReportSourceData` (`cycle-review.repository.ts:219`) does `programResult.data.total_weeks ?? 0`, then the engine treats `totalWeeks` as required `number`. `isDeloadWeek(weekNumber, 0)` returns true for every `weekNumber === 0`, silently producing malformed deload analysis when a user invokes "End Program" on an unending block. Branch `assemble-cycle-report.ts` for null/0 totals, or refuse review generation for unending programs entirely and surface a different "summary" screen.

### Multi-Cycle Context

**`getPreviousCycleSummaries(userId: string, beforeProgramId: string, limit = 3): Promise<PreviousCycleSummary[]>`:**

- [x] Fetches most recent `limit` completed `cycle_reviews` rows, excluding `beforeProgramId` (prevents self-reference when called during the same cycle's generation)
- [x] Maps each row to a typed `PreviousCycleSummary` via `extractSummary()` from training-engine

## Dependencies

- [engine-007-jit-session-generator.md](./engine-007-jit-session-generator.md)
- [infra-005-database-migrations.md](../infra/spec-migrations.md)
- [ai-001-vercel-ai-sdk-setup.md](../ai/spec-sdk-setup.md)
- [docs/design/cycle-review-and-insights.md](./design.md)
- [mobile-014-cycle-review-screen.md](./spec-screen.md)
