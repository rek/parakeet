import { describe, expect, it } from 'vitest';

import type { CompletedSetLog, MuscleContribution, MuscleGroup } from '../types';
import { MUSCLE_GROUPS } from '../types';
import { computeVolumeBreakdown } from './compute-volume-breakdown';
import { computeWeeklyVolume } from './mrv-mev-calculator';

// Simple mapper matching LIFT_MUSCLES for testing
const testMapper = (lift: string | null, exercise?: string): MuscleContribution[] => {
  if (exercise === 'Lat Pulldown') return [{ muscle: 'upper_back', contribution: 1.0 }];
  if (exercise === 'Close-Grip Bench') return [
    { muscle: 'triceps', contribution: 1.0 },
    { muscle: 'chest', contribution: 0.5 },
    { muscle: 'shoulders', contribution: 0.5 },
  ];
  if (lift === 'squat') return [
    { muscle: 'quads', contribution: 1.0 },
    { muscle: 'glutes', contribution: 0.75 },
    { muscle: 'hamstrings', contribution: 0.5 },
    { muscle: 'lower_back', contribution: 0.5 },
  ];
  if (lift === 'bench') return [
    { muscle: 'chest', contribution: 1.0 },
    { muscle: 'triceps', contribution: 0.4 },
    { muscle: 'shoulders', contribution: 0.4 },
  ];
  if (lift === 'deadlift') return [
    { muscle: 'hamstrings', contribution: 1.0 },
    { muscle: 'glutes', contribution: 0.75 },
    { muscle: 'lower_back', contribution: 1.0 },
    { muscle: 'upper_back', contribution: 0.5 },
  ];
  return [];
};

describe('computeVolumeBreakdown', () => {
  describe('consistency with computeWeeklyVolume', () => {
    const cases: { name: string; logs: CompletedSetLog[] }[] = [
      { name: 'empty logs', logs: [] },
      {
        name: 'single main lift session',
        logs: [{ lift: 'squat', completedSets: 4, setRpes: [9, 9, 8, 8] }],
      },
      {
        name: 'main + aux session',
        logs: [
          { lift: 'bench', completedSets: 3, setRpes: [9, 9, 8] },
          { lift: 'bench', completedSets: 3, exercise: 'Close-Grip Bench', setRpes: [8, 8, 7] },
        ],
      },
      {
        name: 'multiple sessions with overlapping exercises',
        logs: [
          { lift: 'squat', completedSets: 4, setRpes: [9, 9, 8, 8] },
          { lift: 'squat', completedSets: 3, setRpes: [9, 8, 8] },
          { lift: 'deadlift', completedSets: 2, setRpes: [10, 9] },
          { lift: 'deadlift', completedSets: 3, exercise: 'Lat Pulldown', setRpes: [8, 7, 7] },
        ],
      },
    ];

    for (const { name, logs } of cases) {
      it(`matches computeWeeklyVolume for ${name}`, () => {
        const breakdown = computeVolumeBreakdown({ sessionLogs: logs, muscleMapper: testMapper });
        const weekly = computeWeeklyVolume(logs, testMapper);

        for (const muscle of MUSCLE_GROUPS) {
          expect(breakdown[muscle].totalVolume).toBe(weekly[muscle]);
        }
      });
    }
  });

  it('merges same exercise across sessions', () => {
    const logs: CompletedSetLog[] = [
      { lift: 'squat', completedSets: 3, setRpes: [9, 9, 8] },
      { lift: 'squat', completedSets: 2, setRpes: [9, 8] },
    ];
    const breakdown = computeVolumeBreakdown({ sessionLogs: logs, muscleMapper: testMapper });
    const quads = breakdown.quads;

    // Should have a single "Squat" entry, not two
    expect(quads.contributions).toHaveLength(1);
    expect(quads.contributions[0].source).toBe('Squat');
    expect(quads.contributions[0].rawSets).toBe(5);
  });

  it('computes fractional contributions correctly', () => {
    const logs: CompletedSetLog[] = [
      { lift: 'bench', completedSets: 3, setRpes: [9, 9, 9] },
    ];
    const breakdown = computeVolumeBreakdown({ sessionLogs: logs, muscleMapper: testMapper });

    const chest = breakdown.chest.contributions.find((c) => c.source === 'Bench');
    const triceps = breakdown.triceps.contributions.find((c) => c.source === 'Bench');
    const shoulders = breakdown.shoulders.contributions.find((c) => c.source === 'Bench');

    expect(chest?.contribution).toBe(1.0);
    expect(chest?.volumeAdded).toBe(3.0);
    expect(triceps?.contribution).toBe(0.4);
    expect(triceps?.volumeAdded).toBe(1.2);
    expect(shoulders?.contribution).toBe(0.4);
    expect(shoulders?.volumeAdded).toBe(1.2);
  });

  it('applies RPE scaling', () => {
    const logs: CompletedSetLog[] = [
      { lift: 'squat', completedSets: 4, setRpes: [10, 8, 7, 5] },
    ];
    const breakdown = computeVolumeBreakdown({ sessionLogs: logs, muscleMapper: testMapper });
    const quads = breakdown.quads.contributions[0];

    // RPE 10=1.0, 8=0.75, 7=0.5, 5=0.0 → effective = 2.25
    expect(quads.effectiveSets).toBe(2.25);
    expect(quads.volumeAdded).toBe(2.25); // × 1.0 contribution
  });

  describe('RPE edge cases', () => {
    it('handles undefined entries in setRpes', () => {
      const logs: CompletedSetLog[] = [
        { lift: 'squat', completedSets: 3, setRpes: [9, undefined, 7] },
      ];
      const breakdown = computeVolumeBreakdown({ sessionLogs: logs, muscleMapper: testMapper });
      // RPE 9=1.0, undefined=1.0, 7=0.5 → 2.5
      expect(breakdown.quads.contributions[0].effectiveSets).toBe(2.5);
    });

    it('handles empty setRpes array', () => {
      const logs: CompletedSetLog[] = [
        { lift: 'squat', completedSets: 3, setRpes: [] },
      ];
      const breakdown = computeVolumeBreakdown({ sessionLogs: logs, muscleMapper: testMapper });
      // Empty array → reduce returns 0
      expect(breakdown.quads.contributions[0].effectiveSets).toBe(0);
      expect(breakdown.quads.totalVolume).toBe(0);
    });

    it('falls back to completedSets when setRpes is undefined', () => {
      const logs: CompletedSetLog[] = [
        { lift: 'squat', completedSets: 4 },
      ];
      const breakdown = computeVolumeBreakdown({ sessionLogs: logs, muscleMapper: testMapper });
      expect(breakdown.quads.contributions[0].effectiveSets).toBe(4);
    });
  });

  it('sorts contributions by volumeAdded descending', () => {
    const logs: CompletedSetLog[] = [
      { lift: 'bench', completedSets: 3, setRpes: [9, 9, 9] },
      { lift: 'bench', completedSets: 3, exercise: 'Close-Grip Bench', setRpes: [8, 8, 8] },
    ];
    const breakdown = computeVolumeBreakdown({ sessionLogs: logs, muscleMapper: testMapper });

    // Chest: Bench 3.0 (1.0×3), CGBP 1.125 (0.5×2.25) → Bench first
    const chest = breakdown.chest.contributions;
    expect(chest[0].source).toBe('Bench');
    expect(chest[1].source).toBe('Close-Grip Bench');
    expect(chest[0].volumeAdded).toBeGreaterThan(chest[1].volumeAdded);
  });

  it('returns empty contributions for muscles with zero volume', () => {
    const breakdown = computeVolumeBreakdown({ sessionLogs: [], muscleMapper: testMapper });

    for (const muscle of MUSCLE_GROUPS) {
      expect(breakdown[muscle].totalVolume).toBe(0);
      expect(breakdown[muscle].contributions).toHaveLength(0);
    }
  });

  it('capitalizes lift name for source label, keeps exercise name as-is', () => {
    const logs: CompletedSetLog[] = [
      { lift: 'bench', completedSets: 3, setRpes: [9, 9, 9] },
      { lift: 'deadlift', completedSets: 3, exercise: 'Lat Pulldown', setRpes: [8, 8, 8] },
    ];
    const breakdown = computeVolumeBreakdown({ sessionLogs: logs, muscleMapper: testMapper });

    expect(breakdown.chest.contributions[0].source).toBe('Bench');
    expect(breakdown.upper_back.contributions[0].source).toBe('Lat Pulldown');
  });
});
