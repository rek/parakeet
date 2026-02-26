# Spec: Multi-Cycle Longitudinal Context

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

How previous cycle summaries are compiled and injected into the LLM prompt when generating the cycle review for a new completed cycle. Enables cross-cycle pattern detection ("bench has stalled for 3 cycles", "RDL shows no correlation over 2 cycles").

## Tasks

### PreviousCycleSummary Type

**File: `packages/training-engine/src/review/cycle-review-generator.ts`**

```typescript
interface PreviousCycleSummary {
  cycleNumber: number
  programLengthWeeks: number
  completionPct: number
  liftProgress: Record<Lift, {
    oneRmStartKg: number
    oneRmEndKg: number
    oneRmChangeKg: number
    avgRpeVsTarget: number    // positive = above target (too hard)
    sessionCount: number
  }>
  topAuxCorrelations: Array<{
    exercise: string
    lift: Lift
    correlationDirection: 'positive' | 'negative' | 'neutral'
  }>
  volumeNotes: string[]           // short bullets from that cycle's review
  formulaChangesCount: number
  disruptionCount: number
  bodyWeightStartKg: number
  bodyWeightEndKg: number
  wilksScore: number
}
```

Summaries are **derived from stored `cycle_reviews` rows** — not re-computed from raw session data. The `cycle_reviews.llm_response` JSONB column already holds the full `CycleReview` object; `previousCycleSummaries` extracts just the fields needed for the multi-cycle prompt.

---

### getPreviousCycleSummaries

**File: `apps/parakeet/src/lib/cycle-review.ts`** — already has this function stub. Implement fully:

```typescript
export async function getPreviousCycleSummaries(
  userId: string,
  beforeProgramId: string,
  limit = 3,
): Promise<PreviousCycleSummary[]> {
  // Fetch the last `limit` completed cycle_reviews before the current program
  const { data, error } = await supabase
    .from('cycle_reviews')
    .select('program_id, llm_response, compiled_report')
    .eq('user_id', userId)
    .neq('program_id', beforeProgramId)
    .not('llm_response', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map(row => extractSummary(row.compiled_report, row.llm_response))
}

function extractSummary(report: CycleReport, review: CycleReview): PreviousCycleSummary {
  return {
    cycleNumber:          report.meta.cycleNumber,
    programLengthWeeks:   report.meta.programLengthWeeks,
    completionPct:        report.meta.completionPct,
    liftProgress:         buildLiftProgress(report.liftSummary),
    topAuxCorrelations:   extractTopAuxCorrelations(review.auxiliaryInsights),
    volumeNotes:          buildVolumeNotes(review.volumeInsights),
    formulaChangesCount:  report.formulaHistory.length,
    disruptionCount:      report.meta.disruptionCount,
    bodyWeightStartKg:    report.meta.bodyWeightStart,
    bodyWeightEndKg:      report.meta.bodyWeightEnd,
    wilksScore:           computeWilks2020(
                            report.meta.biologicalSex,
                            report.meta.bodyWeightEnd,
                            buildTotal(report.liftSummary),
                          ),
  }
}
```

---

### LLM Prompt Integration

**File: `packages/training-engine/src/review/cycle-review-generator.ts`**

The `assembleCycleReviewPrompt()` function receives `previousSummaries: PreviousCycleSummary[]` and appends them to the prompt context:

```typescript
const previousContext = previousSummaries.length > 0
  ? `\n\nPrevious ${previousSummaries.length} cycle(s) summary:\n${JSON.stringify(previousSummaries, null, 2)}`
  : '\n\nThis is the first completed cycle — no historical comparison available.'

const fullContext = currentCycleContext + previousContext
```

**Token budget:** Each `PreviousCycleSummary` is ~400 tokens when serialised. With limit=3, this adds ~1,200 tokens. The full cycle review prompt is typically 3,000–5,000 tokens — this stays well within model context limits.

**Prompt instruction addition:**
```
You have been given summaries of the previous N training cycles. Use this history to:
- Identify trends across cycles (e.g., consistent stalling on a lift)
- Flag exercises that have shown no correlation for 2+ cycles
- Note whether formula changes from previous cycles improved outcomes
- Avoid repeating suggestions that have already been implemented (check formulaChangesCount)
Do not repeat information from previous cycles in your response — focus on what is NEW or CHANGED.
```

---

### compileCycleReport Integration

**File: `apps/parakeet/src/lib/cycle-review.ts`** — `compileCycleReport()` already assembles the current cycle's data. Extend the call site in `getCycleReview()` to also fetch and pass previous summaries:

```typescript
export async function getCycleReview(userId: string, programId: string) {
  const report = await compileCycleReport(userId, programId)
  const previousSummaries = await getPreviousCycleSummaries(userId, programId, 3)
  const review = await generateCycleReview(report, previousSummaries)
  await storeCycleReview(userId, programId, report, review)
  return review
}
```

---

### Unit Tests

**File: `packages/training-engine/src/review/cycle-review-generator.test.ts`** — add:
- [x] `extractSummary()` correctly maps `CycleReport` + `CycleReview` to `PreviousCycleSummary`
- [x] `buildLiftProgress()` computes oneRmChangeKg correctly from liftSummary
- [x] `getPreviousCycleSummaries()` with no prior reviews → returns `[]`
- [x] Prompt includes serialised previous summaries when provided
- [x] Prompt includes "first cycle" message when `previousSummaries` is empty

## Dependencies

- [engine-012-cycle-review-generator.md](./engine-012-cycle-review-generator.md) — `CycleReport`, `CycleReview`, `generateCycleReview()`
- [engine-013-wilks-formula.md](./engine-013-wilks-formula.md) — `computeWilks2020()` used in summary extraction
