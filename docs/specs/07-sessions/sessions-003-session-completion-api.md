# Spec: Session Completion (Supabase Direct)

**Status**: Implemented
**Domain**: Sessions & Performance

## What This Covers

Writing a completed session log to Supabase, computing performance metrics locally using the training engine, and storing the results. No REST API server, no Pub/Sub — everything runs in the app.

## Tasks

**`apps/parakeet/lib/sessions.ts` (completion helper):**

```typescript
async function completeSession(
  sessionId: string,
  userId: string,
  input: CompleteSessionInput
): Promise<void> {
  const { actualSets, sessionRpe, startedAt, completedAt } = input

  // 1. Compute completion stats locally
  const plannedCount = (await getSession(sessionId))?.planned_sets?.length ?? actualSets.length
  const completionPct = (actualSets.filter(s => s.reps_completed > 0).length / plannedCount) * 100
  const performanceVsPlan = classifyPerformance(actualSets, completionPct)

  // 2. Insert session_logs row
  await supabase.from('session_logs').insert({
    session_id: sessionId,
    user_id: userId,
    actual_sets: actualSets,       // JSONB — weights stored in grams
    session_rpe: sessionRpe,
    completion_pct: completionPct,
    performance_vs_plan: performanceVsPlan,
    started_at: startedAt?.toISOString(),
    completed_at: (completedAt ?? new Date()).toISOString(),
  })

  // 3. Update session status to completed
  await supabase
    .from('sessions')
    .update({ status: 'completed' })
    .eq('id', sessionId)

  // 4. Run performance adjuster locally
  const recentLogs = await getRecentLogsForLift(userId, session.primary_lift, 6)
  const suggestions = suggestProgramAdjustments(recentLogs, DEFAULT_THRESHOLDS)

  // 5. Write performance_metrics row
  if (suggestions.length > 0) {
    await supabase.from('performance_metrics').insert({
      session_id: sessionId,
      user_id: userId,
      suggestions,
      computed_at: new Date().toISOString(),
    })
  }
}
```

**`CompleteSessionInput` type:**
```typescript
interface CompleteSessionInput {
  actualSets: {
    set_number: number
    weight_grams: number   // kg × 1000 — e.g. 112500 for 112.5kg
    reps_completed: number
    rpe_actual?: number    // 6.0–10.0 in 0.5 increments
    notes?: string
  }[]
  sessionRpe?: number
  startedAt?: Date
  completedAt?: Date
}
```

**`classifyPerformance` helper:**
- `'over'`: avg actual reps > planned reps by >10%
- `'at'`: within 10% of planned reps
- `'under'`: completion_pct < 90%
- `'incomplete'`: completion_pct < 50%

**Performance adjuster suggestions:**
- If `suggestProgramAdjustments()` returns suggestions, they are stored in `performance_metrics.suggestions` JSONB
- The app reads these on next app open and shows a non-blocking notification: "Based on your recent sessions, consider reducing Squat Heavy intensity by 2.5%. Tap to preview."
- User taps → formula editor screen opens with suggested change pre-filled

## Dependencies

- [sessions-002-session-lifecycle-api.md](./sessions-002-session-lifecycle-api.md)
- [engine-005-performance-adjuster.md](../04-engine/engine-005-performance-adjuster.md)
- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
