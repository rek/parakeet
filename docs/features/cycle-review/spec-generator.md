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
  - `formulaSuggestions`: array with `description`, `rationale`, `priority`, `overrides`
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
