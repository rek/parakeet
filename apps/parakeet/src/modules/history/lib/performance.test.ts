import { describe, expect, it } from 'vitest';

import { processRecentHistory } from './performance-helpers';

function makeRow(opts: {
  completed_at?: string;
  actual_sets?: { weight_grams: number; reps_completed: number }[];
  session_rpe?: number | null;
  completion_pct?: number | null;
}) {
  return {
    completed_at: opts.completed_at ?? '2026-01-01T10:00:00Z',
    actual_sets: opts.actual_sets ?? [],
    session_rpe: opts.session_rpe ?? null,
    completion_pct: opts.completion_pct ?? null,
    sessions: { primary_lift: 'squat', intensity_type: 'heavy' },
  };
}

describe('processRecentHistory', () => {
  it('returns empty entries and null trend for empty input', () => {
    const result = processRecentHistory([]);
    expect(result).toEqual({ entries: [], trend: null });
  });

  it('returns one entry with null trend for a single row', () => {
    const row = makeRow({
      completed_at: '2026-01-10T10:00:00Z',
      actual_sets: [{ weight_grams: 100000, reps_completed: 5 }],
      session_rpe: 8,
      completion_pct: 100,
    });
    const result = processRecentHistory([row]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].completedAt).toBe('2026-01-10T10:00:00Z');
    expect(result.entries[0].estimatedOneRmKg).toBeGreaterThan(0);
    expect(result.entries[0].sessionRpe).toBe(8);
    expect(result.entries[0].completionPct).toBe(100);
    expect(result.trend).toBeNull();
  });

  it('detects improving trend when recent 1RM is substantially higher', () => {
    const rows = [
      makeRow({ actual_sets: [{ weight_grams: 120000, reps_completed: 1 }] }),
      makeRow({ actual_sets: [{ weight_grams: 118000, reps_completed: 1 }] }),
      makeRow({ actual_sets: [{ weight_grams: 116000, reps_completed: 1 }] }),
      makeRow({ actual_sets: [{ weight_grams: 100000, reps_completed: 1 }] }),
      makeRow({ actual_sets: [{ weight_grams: 98000, reps_completed: 1 }] }),
    ];
    const result = processRecentHistory(rows);
    expect(result.entries).toHaveLength(5);
    expect(result.trend).toBe('improving');
  });

  it('detects declining trend when recent 1RM is substantially lower', () => {
    const rows = [
      makeRow({ actual_sets: [{ weight_grams: 98000, reps_completed: 1 }] }),
      makeRow({ actual_sets: [{ weight_grams: 100000, reps_completed: 1 }] }),
      makeRow({ actual_sets: [{ weight_grams: 102000, reps_completed: 1 }] }),
      makeRow({ actual_sets: [{ weight_grams: 118000, reps_completed: 1 }] }),
      makeRow({ actual_sets: [{ weight_grams: 120000, reps_completed: 1 }] }),
    ];
    const result = processRecentHistory(rows);
    expect(result.trend).toBe('declining');
  });

  it('returns stable trend when delta <= 2.5kg', () => {
    const rows = Array.from({ length: 5 }, () =>
      makeRow({ actual_sets: [{ weight_grams: 100000, reps_completed: 1 }] })
    );
    const result = processRecentHistory(rows);
    expect(result.trend).toBe('stable');
  });

  it('treats rows with no sets as 0 estimated 1RM', () => {
    const row = makeRow({ actual_sets: [] });
    const result = processRecentHistory([row]);
    expect(result.entries[0].estimatedOneRmKg).toBe(0);
  });

  it('passes through null RPE and completion pct', () => {
    const row = makeRow({ session_rpe: null, completion_pct: null });
    const result = processRecentHistory([row]);
    expect(result.entries[0].sessionRpe).toBeNull();
    expect(result.entries[0].completionPct).toBeNull();
  });
});
