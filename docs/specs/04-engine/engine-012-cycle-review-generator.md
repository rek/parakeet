# Spec: Cycle Review Generator (v1.5)

**Status**: Planned
**Domain**: Training Engine

## What This Covers

`compileCycleReport()` assembles a structured `CycleReport` from Supabase. `generateCycleReview()` sends it to an LLM via `generateObject()` and stores the typed `CycleReview` result. Formula and developer suggestions are routed to their respective destinations automatically.

See `docs/design/cycle-review-and-insights.md` for the full feature design and examples.

## Tasks

### CycleReview Schema

**`packages/shared-types/src/cycle-review.schema.ts`:**

```typescript
import { z } from 'zod'

export const LiftRatingSchema = z.enum(['excellent', 'good', 'stalled', 'concerning'])

export const CycleReviewSchema = z.object({
  overallAssessment: z.string().max(500),
  progressByLift: z.record(
    z.enum(['squat', 'bench', 'deadlift']),
    z.object({
      rating: LiftRatingSchema,
      narrative: z.string().max(1000),
    })
  ),
  auxiliaryInsights: z.object({
    mostCorrelated: z.array(z.object({
      exercise: z.string(),
      lift: z.string(),
      explanation: z.string(),
    })),
    leastEffective: z.array(z.object({
      exercise: z.string(),
      lift: z.string(),
      explanation: z.string(),
    })),
    recommendedChanges: z.object({
      add: z.array(z.string()).optional(),
      remove: z.array(z.string()).optional(),
    }).optional(),
  }),
  volumeInsights: z.object({
    musclesUnderRecovered: z.array(z.string()),
    musclesUndertrained: z.array(z.string()),
    frequencyRecommendation: z.string().optional(),
  }),
  formulaSuggestions: z.array(z.object({
    description: z.string(),
    rationale: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    overrides: z.record(z.unknown()),  // Partial<FormulaConfig> to apply
  })),
  structuralSuggestions: z.array(z.object({
    description: z.string(),
    rationale: z.string(),
    developerNote: z.string(),
  })),
  nextCycleRecommendations: z.string().max(2000),
  menstrualInsights: z.string().max(1000).optional(),
})

export type CycleReview = z.infer<typeof CycleReviewSchema>
```

### CycleReport Compilation

**`apps/mobile/lib/cycle-review.ts`:**

```typescript
import { supabase } from './supabase'
import type { CycleReport } from '@parakeet/shared-types'

export async function compileCycleReport(
  programId: string,
  userId: string
): Promise<CycleReport> {
  // Parallel Supabase queries — all required data for the report
  const [
    { data: program },
    { data: sessions },
    { data: sessionLogs },
    { data: sorenessCheckins },
    { data: lifterMaxes },
    { data: disruptions },
    { data: auxiliaryAssignments },
    { data: formulaHistory },
  ] = await Promise.all([
    supabase.from('programs').select('*').eq('id', programId).single(),
    supabase.from('sessions').select('*').eq('program_id', programId).order('planned_date'),
    supabase.from('session_logs').select('*').eq('program_id', programId),
    supabase.from('soreness_checkins').select('*').eq('user_id', userId).eq('program_id', programId),
    supabase.from('lifter_maxes').select('*').eq('user_id', userId).order('recorded_at', { ascending: false }).limit(10),
    supabase.from('disruptions').select('*').eq('user_id', userId).eq('program_id', programId),
    supabase.from('auxiliary_assignments').select('*, auxiliary_exercises(*)').eq('program_id', programId),
    supabase.from('formula_configs').select('*').eq('user_id', userId).eq('program_id', programId).order('created_at'),
  ])

  // Assemble the CycleReport struct from the raw Supabase data
  return assembleCycleReport({
    program, sessions, sessionLogs, sorenessCheckins,
    lifterMaxes, disruptions, auxiliaryAssignments, formulaHistory,
  })
}
```

The `assembleCycleReport()` helper (in `packages/training-engine/src/review/assemble-cycle-report.ts`) transforms the raw rows into the `CycleReport` struct shape — computing derived metrics like `avgRpeVsTarget`, `mrvPct`, and mapping aux exercises to subsequent main lift performance.

### Cycle Review Generation

**`packages/training-engine/src/review/cycle-review-generator.ts`:**

```typescript
import { generateObject } from 'ai'
import { CYCLE_REVIEW_MODEL, CYCLE_REVIEW_SYSTEM_PROMPT } from '../ai/prompts'
import { CycleReviewSchema } from '@parakeet/shared-types'
import type { CycleReport, CycleReview } from '@parakeet/shared-types'

export async function generateCycleReview(
  cycleReport: CycleReport,
  previousCycleSummaries: string[]  // brief text summaries of previous 2-3 cycles
): Promise<CycleReview> {
  const prompt = JSON.stringify({
    currentCycle: cycleReport,
    previousCycles: previousCycleSummaries,
  })

  const { object: review } = await generateObject({
    model: CYCLE_REVIEW_MODEL,
    schema: CycleReviewSchema,
    system: CYCLE_REVIEW_SYSTEM_PROMPT,
    prompt,
    // No timeout — this is async; user receives a notification when done
  })

  return review
}
```

No `AbortSignal.timeout()` here. Cycle review is triggered at cycle completion and runs asynchronously. The user does not wait for it — they receive an `expo-notifications` push notification when the `cycle_reviews` row is inserted.

### Storing the Result

**`apps/mobile/lib/cycle-review.ts` (addition):**

```typescript
export async function storeCycleReview(
  programId: string,
  userId: string,
  compiledReport: CycleReport,
  llmResponse: CycleReview
): Promise<void> {
  // 1. Insert the cycle_reviews row
  await supabase.from('cycle_reviews').insert({
    program_id: programId,
    user_id: userId,
    compiled_report: compiledReport,
    llm_response: llmResponse,
    generated_at: new Date().toISOString(),
  })

  // 2. Route formula suggestions → formula_configs table (pending approval)
  for (const suggestion of llmResponse.formulaSuggestions) {
    await supabase.from('formula_configs').insert({
      user_id: userId,
      overrides: suggestion.overrides,
      source: 'ai_suggestion',
      ai_rationale: `${suggestion.description}\n\n${suggestion.rationale}`,
      is_active: false,  // awaits user approval in formula editor
    })
  }

  // 3. Route structural suggestions → developer_suggestions table
  for (const suggestion of llmResponse.structuralSuggestions) {
    await supabase.from('developer_suggestions').insert({
      user_id: userId,
      program_id: programId,
      description: suggestion.description,
      rationale: suggestion.rationale,
      developer_note: suggestion.developerNote,
    })
  }
}
```

### Trigger Flow

**`apps/mobile/lib/programs.ts` — cycle completion handler:**

```typescript
// Called when a program reaches ≥80% session completion
export async function onCycleComplete(programId: string, userId: string): Promise<void> {
  // Run cycle review asynchronously (do not await — user gets notification when done)
  compileCycleReport(programId, userId)
    .then(async (report) => {
      const previousSummaries = await getPreviousCycleSummaries(userId, 3)
      const review = await generateCycleReview(report, previousSummaries)
      await storeCycleReview(programId, userId, report, review)
      // Supabase Realtime triggers cache invalidation → notification in mobile-014
    })
    .catch(console.error)  // LLM failure does not block cycle completion
}
```

### Multi-Cycle Context

**`getPreviousCycleSummaries(userId, count)`** (in `apps/mobile/lib/cycle-review.ts`):
- Fetches the most recent `count` completed `cycle_reviews` rows
- Extracts `llm_response.overallAssessment` + `llm_response.progressByLift` ratings + key metrics
- Returns as an array of short text summaries (kept brief to stay within LLM context limits)

## Dependencies

- [engine-007-jit-session-generator.md](./engine-007-jit-session-generator.md)
- [infra-005-database-migrations.md](../01-infra/infra-005-database-migrations.md)
- [ai-001-vercel-ai-sdk-setup.md](../10-ai/ai-001-vercel-ai-sdk-setup.md)
- [docs/design/cycle-review-and-insights.md](../../design/cycle-review-and-insights.md)
- [mobile-014-cycle-review-screen.md](../09-mobile/mobile-014-cycle-review-screen.md)
