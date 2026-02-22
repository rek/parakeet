# Spec: Performance Read API

**Status**: Planned
**Domain**: Sessions & Performance

## What This Covers

Read endpoints for aggregated performance data. Used by the History tab and future correlation engine.

## Tasks

**Repository (`apps/api/src/modules/performance/performance.repository.ts`):**
- `findByLift(userId: string, lift: Lift, options: TimeRangeOptions): Promise<PerformanceMetric[]>`
- `findAll(userId: string, options: TimeRangeOptions & PaginationOptions): Promise<PaginatedResult<PerformanceMetric>>`
- `findTrends(userId: string, lift?: Lift, lastN?: number): Promise<PerformanceTrend[]>`
  - Computes: avg completion_pct, avg actual_intensity_pct, avg max_rpe, trend direction (improving/declining/stable) per lift

**Routes:**
- `GET /v1/performance`
  - Query: `?from=2026-01-01&to=2026-03-01&lift=squat&block=1`
  - Returns list of `performance_metrics` rows (newest first)
  - Includes `planned_volume`, `actual_volume`, `completion_pct`, `avg_rpe_actual`, `estimated_1rm` per row

- `GET /v1/performance/:lift` (lift = squat | bench | deadlift)
  - Returns metrics for specific lift only
  - Includes estimated 1RM progression over time (useful for progress chart)

- `GET /v1/performance/trends`
  - Returns a summary per lift: current estimated 1RM, trend vs. last cycle, avg completion %, sessions logged
  - Used by the History tab overview section

**Response shape for trends:**
```json
{
  "squat": { "estimated_1rm_lbs": 320, "trend": "improving", "sessions_logged": 24, "avg_completion_pct": 94 },
  "bench": { "estimated_1rm_lbs": 230, "trend": "stable",   "sessions_logged": 24, "avg_completion_pct": 97 },
  "deadlift": { "estimated_1rm_lbs": 370, "trend": "improving", "sessions_logged": 24, "avg_completion_pct": 91 }
}
```

## Dependencies

- [sessions-004-performance-metrics-worker.md](./sessions-004-performance-metrics-worker.md)
