import { describe, expect, it } from 'vitest';

import {
  processRecentHistory,
  type RawHistoryRow,
} from './performance-helpers';

// Build a minimal valid row. The `sessions` field is unused by the pure logic
// in performance-helpers but is required by the RawHistoryRow interface.
function makeRow(
  sets: { weight_grams: number; reps_completed: number }[],
  opts: {
    session_rpe?: number | null;
    completion_pct?: number | null;
    completed_at?: string;
  } = {}
): RawHistoryRow {
  return {
    completed_at: opts.completed_at ?? '2026-01-01T00:00:00Z',
    actual_sets: sets,
    session_rpe: opts.session_rpe ?? null,
    completion_pct: opts.completion_pct ?? null,
    sessions: null,
  };
}

describe('processRecentHistory', () => {
  describe('empty and single-row input', () => {
    it('returns empty entries array and null trend for empty input', () => {
      const { entries, trend } = processRecentHistory([]);
      expect(entries).toEqual([]);
      expect(trend).toBeNull();
    });

    it('returns null trend for a single row (not enough data points)', () => {
      const { trend } = processRecentHistory([
        makeRow([{ weight_grams: 100_000, reps_completed: 5 }]),
      ]);
      expect(trend).toBeNull();
    });

    it('preserves completedAt from the row', () => {
      const { entries } = processRecentHistory([
        makeRow([], { completed_at: '2026-03-15T08:30:00Z' }),
      ]);
      expect(entries[0].completedAt).toBe('2026-03-15T08:30:00Z');
    });
  });

  describe('estimatedOneRmKg calculation', () => {
    it('computes a positive 1RM estimate from a valid set', () => {
      const { entries } = processRecentHistory([
        makeRow([{ weight_grams: 100_000, reps_completed: 5 }]),
      ]);
      // Epley: 100 * (1 + 5/30) ≈ 116.67
      expect(entries[0].estimatedOneRmKg).toBeCloseTo(116.67, 1);
    });

    it('picks the highest 1RM when multiple sets are present', () => {
      const { entries } = processRecentHistory([
        makeRow([
          { weight_grams: 80_000, reps_completed: 5 },
          { weight_grams: 100_000, reps_completed: 5 },
          { weight_grams: 60_000, reps_completed: 10 },
        ]),
      ]);
      // Best: 100 * (1 + 5/30) ≈ 116.67
      expect(entries[0].estimatedOneRmKg).toBeCloseTo(100 * (1 + 5 / 30), 5);
    });

    it('returns 0 when actual_sets is an empty array', () => {
      const { entries } = processRecentHistory([makeRow([])]);
      expect(entries[0].estimatedOneRmKg).toBe(0);
    });

    it('returns 0 when actual_sets is not an array', () => {
      const row: RawHistoryRow = {
        completed_at: '2026-01-01T00:00:00Z',
        actual_sets: null,
        session_rpe: null,
        completion_pct: null,
        sessions: null,
      };
      const { entries } = processRecentHistory([row]);
      expect(entries[0].estimatedOneRmKg).toBe(0);
    });

    it('skips sets with zero weight_grams', () => {
      const { entries } = processRecentHistory([
        makeRow([{ weight_grams: 0, reps_completed: 5 }]),
      ]);
      expect(entries[0].estimatedOneRmKg).toBe(0);
    });

    it('skips sets with zero reps_completed', () => {
      const { entries } = processRecentHistory([
        makeRow([{ weight_grams: 100_000, reps_completed: 0 }]),
      ]);
      expect(entries[0].estimatedOneRmKg).toBe(0);
    });
  });

  describe('RPE and completion passthrough', () => {
    it('passes through non-null session RPE', () => {
      const { entries } = processRecentHistory([
        makeRow([], { session_rpe: 8.5 }),
      ]);
      expect(entries[0].sessionRpe).toBe(8.5);
    });

    it('passes through null session RPE as null', () => {
      const { entries } = processRecentHistory([
        makeRow([], { session_rpe: null }),
      ]);
      expect(entries[0].sessionRpe).toBeNull();
    });

    it('passes through non-null completion pct', () => {
      const { entries } = processRecentHistory([
        makeRow([], { completion_pct: 85 }),
      ]);
      expect(entries[0].completionPct).toBe(85);
    });

    it('passes through null completion pct as null', () => {
      const { entries } = processRecentHistory([
        makeRow([], { completion_pct: null }),
      ]);
      expect(entries[0].completionPct).toBeNull();
    });
  });

  describe('trend computation', () => {
    it('returns null trend with exactly one row', () => {
      const { trend } = processRecentHistory([
        makeRow([{ weight_grams: 100_000, reps_completed: 1 }]),
      ]);
      expect(trend).toBeNull();
    });

    it('returns stable trend when all 1RM values are identical', () => {
      const rows = Array.from({ length: 4 }, () =>
        makeRow([{ weight_grams: 100_000, reps_completed: 1 }])
      );
      expect(processRecentHistory(rows).trend).toBe('stable');
    });

    it('returns stable trend when delta is within ±2.5 kg', () => {
      // recent half slightly above older half but by < 2.5 kg
      const rows = [
        makeRow([{ weight_grams: 102_000, reps_completed: 1 }]),
        makeRow([{ weight_grams: 101_000, reps_completed: 1 }]),
        makeRow([{ weight_grams: 100_000, reps_completed: 1 }]),
        makeRow([{ weight_grams: 100_000, reps_completed: 1 }]),
      ];
      expect(processRecentHistory(rows).trend).toBe('stable');
    });

    it('returns improving when recent avg exceeds older avg by more than 2.5 kg', () => {
      // 5 rows: recent 2 avg ≈ 120, older 3 avg ≈ 100 → delta +20
      const rows = [
        makeRow([{ weight_grams: 120_000, reps_completed: 1 }]),
        makeRow([{ weight_grams: 120_000, reps_completed: 1 }]),
        makeRow([{ weight_grams: 120_000, reps_completed: 1 }]),
        makeRow([{ weight_grams: 100_000, reps_completed: 1 }]),
        makeRow([{ weight_grams: 100_000, reps_completed: 1 }]),
      ];
      expect(processRecentHistory(rows).trend).toBe('improving');
    });

    it('returns declining when recent avg is more than 2.5 kg below older avg', () => {
      const rows = [
        makeRow([{ weight_grams: 100_000, reps_completed: 1 }]),
        makeRow([{ weight_grams: 100_000, reps_completed: 1 }]),
        makeRow([{ weight_grams: 100_000, reps_completed: 1 }]),
        makeRow([{ weight_grams: 120_000, reps_completed: 1 }]),
        makeRow([{ weight_grams: 120_000, reps_completed: 1 }]),
      ];
      expect(processRecentHistory(rows).trend).toBe('declining');
    });
  });

  describe('entry count matches input', () => {
    it('returns one entry per input row', () => {
      const rows = Array.from({ length: 7 }, (_, i) =>
        makeRow([{ weight_grams: (80 + i) * 1_000, reps_completed: 3 }])
      );
      expect(processRecentHistory(rows).entries).toHaveLength(7);
    });
  });
});
