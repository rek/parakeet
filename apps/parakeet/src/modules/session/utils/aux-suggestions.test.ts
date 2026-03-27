import type { ExerciseCatalogEntry } from '@parakeet/training-engine';
import { describe, expect, it } from 'vitest';

import { computeSuggestedAux, computeSuggestedWeight } from './aux-suggestions';

const CATALOG: ExerciseCatalogEntry[] = [
  {
    name: 'Barbell Box Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
    weightPct: 0.7,
  },
  {
    name: 'Romanian Deadlift',
    associatedLift: 'squat',
    primaryMuscles: ['hamstrings', 'glutes'],
    type: 'weighted',
    weightPct: 0.5,
  },
  {
    name: 'Leg Press',
    associatedLift: 'squat',
    primaryMuscles: ['quads'],
    type: 'weighted',
    weightPct: 1.2,
  },
  {
    name: 'Bodyweight Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Bench Press Close Grip',
    associatedLift: 'bench',
    primaryMuscles: ['triceps', 'chest'],
    type: 'weighted',
    weightPct: 0.75,
  },
  {
    name: 'Plank',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'timed',
  },
];

// ── computeSuggestedAux ───────────────────────────────────────────────────────

describe('computeSuggestedAux', () => {
  it('filters to the primary lift', () => {
    const result = computeSuggestedAux('squat', [], CATALOG);
    expect(result).not.toContain('Bench Press Close Grip');
    expect(result).not.toContain('Plank');
  });

  it('excludes exercises already in session', () => {
    const result = computeSuggestedAux('squat', ['Romanian Deadlift'], CATALOG);
    expect(result).not.toContain('Romanian Deadlift');
  });

  it('prioritises exercises covering uncovered muscles', () => {
    // Barbell Box Squat already covers quads+glutes; RDL covers hamstrings+glutes (hamstrings uncovered)
    const result = computeSuggestedAux('squat', ['Barbell Box Squat'], CATALOG);
    // Romanian Deadlift adds hamstrings (not yet covered) — should rank above Leg Press (only quads, covered)
    const rdlIdx = result.indexOf('Romanian Deadlift');
    const lpIdx = result.indexOf('Leg Press');
    expect(rdlIdx).toBeGreaterThanOrEqual(0);
    expect(rdlIdx).toBeLessThan(lpIdx === -1 ? Infinity : lpIdx);
  });

  it('respects maxResults', () => {
    const result = computeSuggestedAux('squat', [], CATALOG, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('falls back to all exercises when primaryLift is null', () => {
    const result = computeSuggestedAux(null, [], CATALOG);
    expect(result).toContain('Bench Press Close Grip');
    expect(result).toContain('Barbell Box Squat');
  });

  it('returns empty when all lift exercises are already in session', () => {
    const existing = [
      'Barbell Box Squat',
      'Romanian Deadlift',
      'Leg Press',
      'Bodyweight Squat',
    ];
    const result = computeSuggestedAux('squat', existing, CATALOG);
    expect(result).toHaveLength(0);
  });
});

// ── computeSuggestedWeight ────────────────────────────────────────────────────

describe('computeSuggestedWeight', () => {
  it('returns weightPct × 1RM rounded to 500g', () => {
    // 140kg 1RM = 140000g, weightPct 0.7 → 98000g, round to nearest 500 = 98000g
    expect(computeSuggestedWeight('Barbell Box Squat', 140_000, CATALOG)).toBe(
      98_000
    );
  });

  it('rounds to nearest 500g', () => {
    // 100000g × 0.5 = 50000g → 50000g (already multiple of 500)
    expect(computeSuggestedWeight('Romanian Deadlift', 100_000, CATALOG)).toBe(
      50_000
    );
    // 100000g × 0.7 = 70000g
    expect(computeSuggestedWeight('Barbell Box Squat', 100_000, CATALOG)).toBe(
      70_000
    );
  });

  it('returns 0 for bodyweight exercises', () => {
    expect(computeSuggestedWeight('Bodyweight Squat', 140_000, CATALOG)).toBe(
      0
    );
  });

  it('returns 0 for timed exercises', () => {
    expect(computeSuggestedWeight('Plank', 140_000, CATALOG)).toBe(0);
  });

  it('returns 0 for unknown exercise names', () => {
    expect(computeSuggestedWeight('Unknown Exercise', 140_000, CATALOG)).toBe(
      0
    );
  });

  it('returns 0 when oneRmGrams is 0', () => {
    expect(computeSuggestedWeight('Barbell Box Squat', 0, CATALOG)).toBe(0);
  });

  it('uses default weightPct 0.675 when not specified', () => {
    const entry: ExerciseCatalogEntry = {
      name: 'Custom Lift',
      associatedLift: 'bench',
      primaryMuscles: ['chest'],
      type: 'weighted',
      // no weightPct
    };
    const result = computeSuggestedWeight('Custom Lift', 100_000, [
      ...CATALOG,
      entry,
    ]);
    // 100000 × 0.675 = 67500 → round to nearest 500 = 67500
    expect(result).toBe(67_500);
  });
});
