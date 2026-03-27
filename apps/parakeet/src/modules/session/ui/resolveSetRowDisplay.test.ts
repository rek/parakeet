import { describe, expect, it } from 'vitest';

import { resolveSetRowDisplay } from './resolveSetRowDisplay';

function makeArgs(
  overrides?: Partial<Parameters<typeof resolveSetRowDisplay>[0]>
) {
  return {
    plannedWeightKg: 50,
    plannedReps: 5,
    localWeightKg: 50,
    localWeightText: '50',
    localReps: 5,
    localIsCompleted: false,
    isCompletedExternal: false,
    ...overrides,
  };
}

describe('resolveSetRowDisplay', () => {
  describe('editing mode (not completed)', () => {
    it('displays local values', () => {
      const result = resolveSetRowDisplay(makeArgs());

      expect(result.displayReps).toBe(5);
      expect(result.displayWeightKg).toBe(50);
      expect(result.displayWeightText).toBe('50');
      expect(result.displayCompleted).toBe(false);
    });

    it('displays locally edited reps', () => {
      const result = resolveSetRowDisplay(makeArgs({ localReps: 3 }));

      expect(result.displayReps).toBe(3);
    });

    it('displays locally edited weight', () => {
      const result = resolveSetRowDisplay(
        makeArgs({ localWeightKg: 52.5, localWeightText: '52.5' })
      );

      expect(result.displayWeightKg).toBe(52.5);
      expect(result.displayWeightText).toBe('52.5');
    });

    it('reflects local completion toggle', () => {
      const result = resolveSetRowDisplay(makeArgs({ localIsCompleted: true }));

      expect(result.displayCompleted).toBe(true);
    });
  });

  describe('externally completed (PostRestOverlay)', () => {
    it('displays actual reps from props, not local edits', () => {
      const result = resolveSetRowDisplay(
        makeArgs({
          isCompletedExternal: true,
          plannedReps: 3, // actual failed reps passed as prop
          localReps: 5, // stale local state from initial planned value
        })
      );

      expect(result.displayReps).toBe(3);
      expect(result.displayCompleted).toBe(true);
    });

    it('displays actual weight from props, not local edits', () => {
      const result = resolveSetRowDisplay(
        makeArgs({
          isCompletedExternal: true,
          plannedWeightKg: 47.5, // actual weight (carry-forward)
          localWeightKg: 50, // stale local state
          localWeightText: '50',
        })
      );

      expect(result.displayWeightKg).toBe(47.5);
      expect(result.displayWeightText).toBe('47.5');
    });

    it('handles bodyweight (0kg) external completion', () => {
      const result = resolveSetRowDisplay(
        makeArgs({
          isCompletedExternal: true,
          plannedWeightKg: 0,
          plannedReps: 7,
        })
      );

      expect(result.displayWeightKg).toBe(0);
      expect(result.displayWeightText).toBe('');
      expect(result.displayReps).toBe(7);
    });

    it('ignores local completion state when externally completed', () => {
      const result = resolveSetRowDisplay(
        makeArgs({
          isCompletedExternal: true,
          localIsCompleted: false,
        })
      );

      expect(result.displayCompleted).toBe(true);
    });

    it('uses planned values for normal completion (no reps change)', () => {
      const result = resolveSetRowDisplay(
        makeArgs({
          isCompletedExternal: true,
          plannedReps: 5,
          plannedWeightKg: 50,
        })
      );

      expect(result.displayReps).toBe(5);
      expect(result.displayWeightKg).toBe(50);
    });
  });
});
