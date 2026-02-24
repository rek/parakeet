# Spec: Performance Read (Supabase Direct)

**Status**: Implemented
**Domain**: Sessions & Performance

## What This Covers

Helper functions for reading aggregated performance data from Supabase. Used by the History tab. All reads go directly to Supabase; no REST API server.

## Tasks

**`apps/parakeet/lib/performance.ts`:**

```typescript
// Get performance metrics for a specific lift (for progress chart)
async function getPerformanceByLift(
  userId: string,
  lift: Lift,
  fromDate?: Date
): Promise<SessionLog[]> {
  let query = supabase
    .from('session_logs')
    .select(`
      id, completed_at, completion_pct, session_rpe,
      actual_sets,
      sessions!inner(primary_lift, intensity_type, block_number, week_number)
    `)
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })

  if (fromDate) {
    query = query.gte('completed_at', fromDate.toISOString())
  }
  const { data } = await query
  return data ?? []
}

// Performance trends summary per lift (History tab overview)
async function getPerformanceTrends(userId: string): Promise<PerformanceTrend[]> {
  const { data } = await supabase
    .from('session_logs')
    .select(`
      completion_pct, session_rpe, actual_sets,
      sessions!inner(primary_lift, intensity_type)
    `)
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(30)  // last 30 sessions is enough for trend computation

  // Compute trends locally in the app using training-engine helpers
  return computeTrends(data ?? [])
}

// Pending adjustment suggestions (surfaced as in-app notifications)
async function getPendingAdjustmentSuggestions(userId: string): Promise<AdjustmentSuggestion[]> {
  const { data } = await supabase
    .from('performance_metrics')
    .select('suggestions, computed_at, session_id')
    .eq('user_id', userId)
    .eq('reviewed', false)
    .order('computed_at', { ascending: false })
  return data?.flatMap(r => r.suggestions) ?? []
}
```

**`computeTrends` (local, in training-engine):**
- Groups last 30 session logs by `primary_lift`
- Per lift: avg `completion_pct`, latest estimated 1RM (Epley from heaviest actual set), trend direction (improving/stable/declining)
- Trend: compare estimated 1RM from sessions 1-5 vs sessions 25-30; if delta > 2.5kg → improving; if < -2.5kg → declining; else stable

**Response shape for trends (all weights in kg):**
```typescript
interface PerformanceTrend {
  lift: Lift
  estimatedOneRmKg: number
  trend: 'improving' | 'stable' | 'declining'
  sessionsLogged: number
  avgCompletionPct: number
}
```

## Dependencies

- [sessions-003-session-completion-api.md](./sessions-003-session-completion-api.md)
- [engine-001-one-rep-max-formulas.md](../04-engine/engine-001-one-rep-max-formulas.md)
- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
