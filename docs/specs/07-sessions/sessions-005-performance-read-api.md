# Spec: Performance Read (Supabase Direct)

**Status**: Implemented
**Domain**: Sessions & Performance

## What This Covers

Helper functions for reading aggregated performance data from Supabase. Used by the History tab. All reads go directly to Supabase; no REST API server.

## Tasks

**`apps/parakeet/lib/performance.ts`:**
- [x] `getPerformanceByLift(userId: string, lift: Lift, fromDate?: Date): Promise<SessionLog[]>` — session logs for a specific lift joined with session metadata, newest first
- [x] `getPerformanceTrends(userId: string): Promise<PerformanceTrend[]>` — last 30 sessions, trends computed locally via `computeTrends()`
- [x] `getPendingAdjustmentSuggestions(userId: string): Promise<AdjustmentSuggestion[]>` — unreviewed performance_metrics suggestions, newest first

**`computeTrends` (local, in training-engine):**
- [x] Groups last 30 session logs by `primary_lift`
- [x] Per lift: avg `completion_pct`, latest estimated 1RM (Epley from heaviest actual set), trend direction
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
