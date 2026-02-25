# Spec: Cycle Review Generator (v1.5)

**Status**: Planned
**Domain**: Training Engine

## What This Covers

`compileCycleReport()` assembles a structured `CycleReport` from Supabase. `generateCycleReview()` sends it to an LLM via `generateObject()` and stores the typed `CycleReview` result. Formula and developer suggestions are routed to their respective destinations automatically.

See `docs/design/cycle-review-and-insights.md` for the full feature design and examples.

## Tasks

### CycleReview Schema

**`packages/shared-types/src/cycle-review.schema.ts`:**
- [ ] Define and export `CycleReviewSchema` with all fields:
  - `overallAssessment`: string, max 500 chars
  - `progressByLift`: record of squat/bench/deadlift with `rating` (LiftRatingSchema) and `narrative`
  - `auxiliaryInsights`: `mostCorrelated`, `leastEffective`, `recommendedChanges`
  - `volumeInsights`: `musclesUnderRecovered`, `musclesUndertrained`, `frequencyRecommendation`
  - `formulaSuggestions`: array with `description`, `rationale`, `priority`, `overrides`
  - `structuralSuggestions`: array with `description`, `rationale`, `developerNote`
  - `nextCycleRecommendations`: string, max 2000 chars
  - `menstrualInsights`: optional string, max 1000 chars
- [ ] Export `type CycleReview = z.infer<typeof CycleReviewSchema>`

### CycleReport Compilation

**`apps/parakeet/lib/cycle-review.ts`:**
- [ ] `compileCycleReport(programId: string, userId: string): Promise<CycleReport>`
  - Parallel Supabase queries for: program, sessions, sessionLogs, sorenessCheckins, lifterMaxes, disruptions, auxiliaryAssignments, formulaHistory
  - Calls `assembleCycleReport()` from training-engine to transform raw rows into `CycleReport` struct

**`packages/training-engine/src/review/assemble-cycle-report.ts`:**
- [ ] `assembleCycleReport(rawData): CycleReport`
  - Computes derived metrics: `avgRpeVsTarget`, `mrvPct`, aux exercise → main lift performance mapping

### Cycle Review Generation

**`packages/training-engine/src/review/cycle-review-generator.ts`:**
- [ ] `generateCycleReview(cycleReport: CycleReport, previousCycleSummaries: string[]): Promise<CycleReview>`
  - Calls `generateObject()` with `CYCLE_REVIEW_MODEL` and `CYCLE_REVIEW_SYSTEM_PROMPT`
  - No `AbortSignal.timeout()` — runs asynchronously, user notified when done

### Storing the Result

**`apps/parakeet/lib/cycle-review.ts` (addition):**
- [ ] `storeCycleReview(programId, userId, compiledReport, llmResponse): Promise<void>`
  - Inserts `cycle_reviews` row with `compiled_report` and `llm_response` JSONB
  - Routes `formulaSuggestions` → inserts pending `formula_configs` rows (`is_active: false`, `source: 'ai_suggestion'`)
  - Routes `structuralSuggestions` → inserts `developer_suggestions` rows

### Trigger Flow

**`apps/parakeet/lib/programs.ts` — cycle completion handler:**
- [ ] `onCycleComplete(programId: string, userId: string): Promise<void>`
  - Triggered when program reaches ≥80% session completion
  - Runs `compileCycleReport` → `generateCycleReview` → `storeCycleReview` asynchronously (no await on outer call)
  - Errors are caught and logged; LLM failure does not block cycle completion

### Multi-Cycle Context

**`getPreviousCycleSummaries(userId, count)`:**
- [ ] Fetches most recent `count` completed `cycle_reviews` rows
- [ ] Extracts `overallAssessment` + `progressByLift` ratings + key metrics as brief text summaries

## Dependencies

- [engine-007-jit-session-generator.md](./engine-007-jit-session-generator.md)
- [infra-005-database-migrations.md](../01-infra/infra-005-database-migrations.md)
- [ai-001-vercel-ai-sdk-setup.md](../10-ai/ai-001-vercel-ai-sdk-setup.md)
- [docs/design/cycle-review-and-insights.md](../../design/cycle-review-and-insights.md)
- [parakeet-014-cycle-review-screen.md](../09-parakeet/parakeet-014-cycle-review-screen.md)
