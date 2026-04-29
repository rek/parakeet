import { describe, expect, it } from 'vitest';

import type { RecoverySnapshot } from '@parakeet/shared-types';
import {
  assembleCycleReport,
  buildRecoverySummary,
} from '../assemble-cycle-report';
import type { RawCycleData } from '../assemble-cycle-report';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(
  date: string,
  overrides: Partial<RecoverySnapshot> = {}
): RecoverySnapshot {
  return {
    id: `snap-${date}`,
    user_id: 'user-1',
    date,
    hrv_rmssd: null,
    hrv_baseline_7d: null,
    hrv_pct_change: null,
    resting_hr: null,
    resting_hr_baseline_7d: null,
    rhr_pct_change: null,
    sleep_duration_min: null,
    deep_sleep_pct: null,
    rem_sleep_pct: null,
    spo2_avg: null,
    steps_24h: null,
    active_minutes_24h: null,
    readiness_score: null,
    created_at: `${date}T10:00:00Z`,
    ...overrides,
  };
}

function makeMinimalRaw(
  overrides: Partial<RawCycleData> = {}
): RawCycleData {
  return {
    program: {
      id: 'prog-1',
      total_weeks: 4,
      start_date: '2026-01-01',
      status: 'completed',
    },
    sessions: [],
    sessionLogs: [],
    sorenessCheckins: [],
    lifterMaxes: [],
    disruptions: [],
    auxiliaryAssignments: [],
    formulaHistory: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildRecoverySummary', () => {
  it('empty array → null', () => {
    expect(buildRecoverySummary([])).toBeNull();
  });

  it('assembleCycleReport with recoverySnapshots:[] → recoverySummary null', () => {
    const report = assembleCycleReport(
      makeMinimalRaw({ recoverySnapshots: [] })
    );
    expect(report.recoverySummary).toBeNull();
  });

  it('assembleCycleReport without recoverySnapshots → recoverySummary null', () => {
    const report = assembleCycleReport(makeMinimalRaw());
    expect(report.recoverySummary).toBeNull();
  });

  it('all-null physiology snapshots → dayCount > 0, all aggregates null, no streaks', () => {
    const snapshots = [
      makeSnapshot('2026-01-01'),
      makeSnapshot('2026-01-02'),
    ];
    const summary = buildRecoverySummary(snapshots);
    expect(summary).not.toBeNull();
    expect(summary!.dayCount).toBe(2);
    expect(summary!.avgReadinessScore).toBeNull();
    expect(summary!.avgHrvPctChange).toBeNull();
    expect(summary!.avgRhrPctChange).toBeNull();
    expect(summary!.avgSleepDurationMin).toBeNull();
    expect(summary!.lowReadinessStreaks).toHaveLength(0);
  });

  it('5 days with scores [80, 78, 45, 40, 38] → one streak covering days 3–5', () => {
    const snapshots = [
      makeSnapshot('2026-01-01', { readiness_score: 80 }),
      makeSnapshot('2026-01-02', { readiness_score: 78 }),
      makeSnapshot('2026-01-03', { readiness_score: 45 }),
      makeSnapshot('2026-01-04', { readiness_score: 40 }),
      makeSnapshot('2026-01-05', { readiness_score: 38 }),
    ];
    const summary = buildRecoverySummary(snapshots);
    expect(summary!.lowReadinessStreaks).toHaveLength(1);
    const streak = summary!.lowReadinessStreaks[0];
    expect(streak.start).toBe('2026-01-03');
    expect(streak.end).toBe('2026-01-05');
    expect(streak.avgScore).toBe(41);
  });

  it('two non-adjacent low days → no streak', () => {
    const snapshots = [
      makeSnapshot('2026-01-01', { readiness_score: 40 }),
      makeSnapshot('2026-01-02', { readiness_score: 80 }),
      makeSnapshot('2026-01-03', { readiness_score: 40 }),
    ];
    const summary = buildRecoverySummary(snapshots);
    expect(summary!.lowReadinessStreaks).toHaveLength(0);
  });

  it('14+ snapshots → recent has the last 14 only', () => {
    const snapshots = Array.from({ length: 20 }, (_, i) =>
      makeSnapshot(`2026-01-${String(i + 1).padStart(2, '0')}`)
    );
    const summary = buildRecoverySummary(snapshots);
    expect(summary!.recent).toHaveLength(14);
    expect(summary!.recent[0].date).toBe('2026-01-07');
    expect(summary!.recent[13].date).toBe('2026-01-20');
  });

  it('HRV averaging: [-5, -10, null, -15] → avgHrvPctChange -10', () => {
    const snapshots = [
      makeSnapshot('2026-01-01', { hrv_pct_change: -5 }),
      makeSnapshot('2026-01-02', { hrv_pct_change: -10 }),
      makeSnapshot('2026-01-03', { hrv_pct_change: null }),
      makeSnapshot('2026-01-04', { hrv_pct_change: -15 }),
    ];
    const summary = buildRecoverySummary(snapshots);
    expect(summary!.avgHrvPctChange).toBe(-10);
  });
});
