# Spec: Cycle Review Recovery Integration

**Status**: Planned
**Domain**: Training Engine + App (cycle-review module)
**Phase**: 2 (alongside engine integration) — small scope, can land in Phase 1 if convenient
**Owner**: any executor agent

## What This Covers

Add daily recovery snapshots to the `CycleReport` that the LLM sees during cycle review, so it can correlate HRV trends, RHR drift, and sleep patterns with performance outcomes. Update `RawCycleData` to carry the snapshots, extend `assembleCycleReport` to compute simple cycle-level recovery aggregates, and update `CYCLE_REVIEW_SYSTEM_PROMPT` so the model knows what to do with the data.

## Why This Is Its Own Spec

The cycle review change touches three modules (engine, cycle-review app module, prompt) and has no dependency on Phase 3/4 work. Splitting it out keeps `spec-pipeline.md` and `spec-readiness-adjuster.md` focused.

## Prerequisites

- [spec-biometric-types.md](./spec-biometric-types.md) — `RecoverySnapshot` type.
- [spec-biometric-data.md](./spec-biometric-data.md) — `recovery_snapshots` table + `fetchSnapshotsForRange` repo.
- [spec-pipeline.md](./spec-pipeline.md) — `fetchSnapshotsForRange` exported from `@modules/wearable`.

## Existing Surface

- `packages/training-engine/src/review/assemble-cycle-report.ts` (verified at scan):
  - `interface RawCycleData` at line 75: input to assembly. Currently has program, sessions, sessionLogs, sorenessCheckins, lifterMaxes, disruptions, auxiliaryAssignments, formulaHistory, weeklyBodyReviews.
  - `interface CycleReport` at line 132: structured summary sent to the LLM.
  - `function assembleCycleReport(raw): CycleReport` at line 158.
- `packages/training-engine/src/ai/prompts.ts` — `CYCLE_REVIEW_SYSTEM_PROMPT`.
- App callers: `apps/parakeet/src/modules/cycle-review/lib/cycle-review.ts` and `apps/parakeet/src/modules/cycle-review/data/cycle-review.repository.ts` (per scan).

## Tasks

### 1. Extend `RawCycleData`

**File:** `packages/training-engine/src/review/assemble-cycle-report.ts`

Add an optional field — optional because cycles run before the wearable feature shipped will have no snapshots:

```typescript
import type { RecoverySnapshot } from '@parakeet/shared-types';

export interface RawCycleData {
  // ... existing fields ...
  /** Daily recovery snapshots covering the cycle's date range — optional */
  recoverySnapshots?: RecoverySnapshot[];
}
```

### 2. Extend `CycleReport` with a recovery summary

```typescript
export interface RecoverySummary {
  /** Days with a snapshot row (signal coverage indicator) */
  dayCount: number;
  /** Mean readiness score across all days that had a non-null score, or null */
  avgReadinessScore: number | null;
  /** Mean HRV % change vs baseline across the cycle, or null */
  avgHrvPctChange: number | null;
  /** Mean RHR % change vs baseline across the cycle, or null */
  avgRhrPctChange: number | null;
  /** Mean sleep duration in minutes across days with sleep data, or null */
  avgSleepDurationMin: number | null;
  /** Date ranges (3+ consecutive days) where avgReadinessScore < 50 — likely overreaching */
  lowReadinessStreaks: Array<{ start: string; end: string; avgScore: number }>;
  /** Up to 14 most recent snapshot rows for chart context — keep payload small */
  recent: RecoverySnapshot[];
}

export interface CycleReport {
  // ... existing fields ...
  /** Recovery summary — null when no recovery snapshots exist for the cycle */
  recoverySummary: RecoverySummary | null;
}
```

### 3. Implement aggregation in `assembleCycleReport`

Add a helper:

```typescript
function buildRecoverySummary(snapshots: RecoverySnapshot[]): RecoverySummary | null {
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

  const mean = (xs: number[]): number | null =>
    xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

  const scores       = sorted.map((s) => s.readiness_score).filter((v): v is number => v !== null);
  const hrvChanges   = sorted.map((s) => s.hrv_pct_change).filter((v): v is number => v !== null);
  const rhrChanges   = sorted.map((s) => s.rhr_pct_change).filter((v): v is number => v !== null);
  const sleepDur     = sorted.map((s) => s.sleep_duration_min).filter((v): v is number => v !== null);

  // Identify ≥3 consecutive days with score < 50
  const lowStreaks: RecoverySummary['lowReadinessStreaks'] = [];
  let runStart = -1;
  let runScores: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const score = sorted[i].readiness_score;
    const isLow = score !== null && score < 50;
    if (isLow) {
      if (runStart < 0) runStart = i;
      runScores.push(score);
    }
    if ((!isLow || i === sorted.length - 1) && runStart >= 0) {
      const runEnd = isLow ? i : i - 1;
      if (runEnd - runStart + 1 >= 3) {
        lowStreaks.push({
          start: sorted[runStart].date,
          end: sorted[runEnd].date,
          avgScore: mean(runScores)!,
        });
      }
      runStart = -1;
      runScores = [];
    }
  }

  return {
    dayCount: sorted.length,
    avgReadinessScore:    mean(scores),
    avgHrvPctChange:      mean(hrvChanges),
    avgRhrPctChange:      mean(rhrChanges),
    avgSleepDurationMin:  mean(sleepDur),
    lowReadinessStreaks:  lowStreaks,
    recent:               sorted.slice(-14),
  };
}
```

In `assembleCycleReport`:

```typescript
return {
  // existing return fields...
  recoverySummary: raw.recoverySnapshots ? buildRecoverySummary(raw.recoverySnapshots) : null,
};
```

### 4. Wire up the app caller

**File:** `apps/parakeet/src/modules/cycle-review/lib/cycle-review.ts`

Where the existing `compileCycleReport` (or equivalent) calls `fetchCycleReportSourceData(programId, userId)` then `assembleCycleReport(raw)`:

- Compute the cycle date range. Use `raw.program.start_date` for the start; for the end use the latest `session.scheduled_date` or the program's end-date if stored.
- Call `fetchSnapshotsForRange(userId, startDate, endDate)` from `@modules/wearable`.
- Spread into the `assembleCycleReport` input:

```typescript
const recoverySnapshots = await fetchSnapshotsForRange(userId, startDate, endDate);
const report = assembleCycleReport({ ...raw, recoverySnapshots });
```

If wearable data is consistently absent, the additional fetch is cheap (single SELECT, RLS-scoped) and `recoverySummary` ends up `null` — no impact on existing flows.

### 5. Prompt update

**File:** `packages/training-engine/src/ai/prompts.ts`

Append to `CYCLE_REVIEW_SYSTEM_PROMPT`:

```
Recovery data (when present in `recoverySummary`):
- recoverySummary.dayCount — number of days the lifter had wearable coverage. Low coverage means recovery analysis is unreliable; weight your conclusions accordingly.
- recoverySummary.avgReadinessScore — cycle-level mean of the daily 0–100 composite. Below 55 across the whole cycle is a yellow flag.
- recoverySummary.avgHrvPctChange — mean HRV change vs baseline. Sustained negative drift correlates with overreaching.
- recoverySummary.avgRhrPctChange — mean RHR change vs baseline. Sustained positive drift corroborates HRV concerns.
- recoverySummary.avgSleepDurationMin — cycle-level mean sleep. Below 380 (~6h20m) routinely is a sleep-debt finding worth surfacing.
- recoverySummary.lowReadinessStreaks — date ranges of ≥3 consecutive days with score < 50. Cross-reference with weeks where performance dipped — this is the strongest overreaching evidence available.
- recoverySummary.recent — last 14 daily snapshot rows for chart context.

When recoverySummary is null, do not speculate about recovery. Note that wearable data was not available and confine the review to subjective signals and performance.

Sustained HRV decline of >10% for three or more days often precedes performance drops by 1–2 sessions — flag this when present.
Sleep patterns correlated with the training schedule (e.g. consistently <6h on training days) reveal scheduling issues — suggest schedule adjustments rather than reducing volume.
```

### 6. Tests

**File:** `packages/training-engine/src/review/__tests__/assemble-cycle-report-recovery.test.ts` (new file)

- `buildRecoverySummary([])` — returns null via `assembleCycleReport(raw)` with `recoverySnapshots: []` ⇒ `recoverySummary === null`.
- All-null physiology snapshots → `dayCount > 0`, all aggregates `null`, no streaks.
- 5 days with scores `[80, 78, 45, 40, 38]` → `lowReadinessStreaks` contains one entry covering days 3–5 with `avgScore = 41`.
- Two non-adjacent low days → no streak (length < 3).
- 14+ snapshots → `recent` has the last 14 only.
- HRV %change averaging: snapshots with values `[-5, -10, null, -15]` → `avgHrvPctChange === -10` (rounded to 1 decimal).

## Validation

- `npx vitest run packages/training-engine` — green.
- Cycle review run against a program with synthetic recovery snapshots → LLM payload includes `recoverySummary`; report references HRV trends in its rationale when streaks exist.
- Cycle review run against a program with no snapshots → `recoverySummary === null`, prompt acknowledges absence (per the appended prompt instruction).

## Out of Scope

- Daily recovery card UI — see [spec-recovery-card.md](./spec-recovery-card.md).
- Auto-suggesting deloads from streaks — out of scope; the LLM may suggest, the engine does not auto-act on cycle-level recovery data in v1.
- Per-muscle recovery — wearables don't measure it; not addressable here.

## Dependencies

- Upstream: spec-biometric-types, spec-biometric-data, spec-pipeline (`fetchSnapshotsForRange`).
- Downstream: none.

## Domain References

- [domain/performance-analysis.md](../../domain/performance-analysis.md)
- [domain/athlete-signals.md](../../domain/athlete-signals.md)
