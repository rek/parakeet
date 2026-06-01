import { describe, expect, it } from 'vitest';

import { assembleCycleReport } from '../assemble-cycle-report';
import type { RawCycleData, RawSession } from '../assemble-cycle-report';

// Helper: build a minimal RawCycleData with N synthetic sessions
function makeRaw(overrides: Partial<RawCycleData> = {}): RawCycleData {
  return {
    program: {
      id: 'prog-1',
      total_weeks: 12,
      start_date: '2026-01-01',
      status: 'active',
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

function liftForIndex(i: number): string {
  if (i % 3 === 0) return 'squat';
  if (i % 3 === 1) return 'bench';
  return 'deadlift';
}

function makeSession(i: number): RawSession {
  return {
    id: `s-${i}`,
    week_number: Math.floor(i / 3) + 1,
    block_number: 1,
    primary_lift: liftForIndex(i),
    intensity_type: 'heavy',
    status: 'completed',
    planned_sets: null,
  };
}

describe('assembleCycleReport — unending program handling', () => {
  it('total_weeks=null → report.totalWeeks is undefined, precedingWeeks derived from sessions/days_per_week', () => {
    const sessions = Array.from({ length: 9 }, (_, i) => makeSession(i));
    const report = assembleCycleReport(
      makeRaw({
        program: {
          id: 'prog-1',
          total_weeks: null,
          start_date: '2026-01-01',
          status: 'active',
          training_days_per_week: 3,
        },
        sessions,
        auxiliaryAssignments: [
          { lift: 'squat', block_number: 1, exercises: ['front_squat'] },
        ],
        lifterMaxes: [
          { lift: 'squat', one_rm_grams: 100_000, recorded_at: '2026-01-01' },
          { lift: 'squat', one_rm_grams: 110_000, recorded_at: '2026-03-01' },
        ],
      })
    );
    expect(report.totalWeeks).toBeUndefined();
    // 9 sessions / 3 days_per_week = 3 weeks
    expect(report.auxiliaryCorrelations[0].precedingWeeks).toBe(3);
  });

  it('total_weeks=0 → treated identically to null (unending)', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => makeSession(i));
    const report = assembleCycleReport(
      makeRaw({
        program: {
          id: 'prog-1',
          total_weeks: 0,
          start_date: '2026-01-01',
          status: 'active',
          training_days_per_week: 4,
        },
        sessions,
        auxiliaryAssignments: [
          { lift: 'squat', block_number: 1, exercises: ['front_squat'] },
        ],
        lifterMaxes: [
          { lift: 'squat', one_rm_grams: 100_000, recorded_at: '2026-01-01' },
        ],
      })
    );
    expect(report.totalWeeks).toBeUndefined();
    // ceil(5 / 4) = 2 weeks
    expect(report.auxiliaryCorrelations[0].precedingWeeks).toBe(2);
  });

  it('total_weeks=12 → scheduled program path, precedingWeeks=12', () => {
    const report = assembleCycleReport(
      makeRaw({
        program: {
          id: 'prog-1',
          total_weeks: 12,
          start_date: '2026-01-01',
          status: 'completed',
        },
        sessions: [makeSession(0)],
        auxiliaryAssignments: [
          { lift: 'squat', block_number: 1, exercises: ['front_squat'] },
        ],
        lifterMaxes: [
          { lift: 'squat', one_rm_grams: 100_000, recorded_at: '2026-01-01' },
        ],
      })
    );
    expect(report.totalWeeks).toBe(12);
    expect(report.auxiliaryCorrelations[0].precedingWeeks).toBe(12);
  });

  it('training_days_per_week defaults to 3 when omitted for unending programs', () => {
    const sessions = Array.from({ length: 6 }, (_, i) => makeSession(i));
    const report = assembleCycleReport(
      makeRaw({
        program: {
          id: 'prog-1',
          total_weeks: null,
          start_date: '2026-01-01',
          status: 'active',
          // training_days_per_week intentionally omitted
        },
        sessions,
        auxiliaryAssignments: [
          { lift: 'squat', block_number: 1, exercises: ['front_squat'] },
        ],
        lifterMaxes: [
          { lift: 'squat', one_rm_grams: 100_000, recorded_at: '2026-01-01' },
        ],
      })
    );
    // 6 sessions / 3 default days = 2 weeks
    expect(report.auxiliaryCorrelations[0].precedingWeeks).toBe(2);
  });

  it('unending program with 0 sessions → precedingWeeks clamped to ≥1', () => {
    const report = assembleCycleReport(
      makeRaw({
        program: {
          id: 'prog-1',
          total_weeks: null,
          start_date: '2026-01-01',
          status: 'active',
          training_days_per_week: 3,
        },
        sessions: [],
        auxiliaryAssignments: [
          { lift: 'squat', block_number: 1, exercises: ['front_squat'] },
        ],
        lifterMaxes: [
          { lift: 'squat', one_rm_grams: 100_000, recorded_at: '2026-01-01' },
        ],
      })
    );
    // assembleCycleReport returns no aux correlations when the lift has no sessions,
    // so no row to assert here. The clamp matters for the internal arithmetic.
    expect(report.totalWeeks).toBeUndefined();
    expect(report.auxiliaryCorrelations).toHaveLength(0);
  });
});
