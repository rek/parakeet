import { describe, expect, it } from 'vitest';

import { DEFAULT_CARDIO_POOL } from './exercise-catalog';
import {
  createExerciseTyper,
  getExerciseType,
} from './exercise-types';

describe('createExerciseTyper', () => {
  it('matches getExerciseType for catalog names when no custom map is supplied', () => {
    const typer = createExerciseTyper();
    expect(typer('Plank')).toBe(getExerciseType('Plank'));
    expect(typer('Barbell Front Squat')).toBe(
      getExerciseType('Barbell Front Squat')
    );
    expect(typer('Pull-ups')).toBe(getExerciseType('Pull-ups'));
  });

  it('honours user-defined types for names absent from the catalog', () => {
    const typer = createExerciseTyper({ Running: 'timed' });
    expect(typer('Running')).toBe('timed');
  });

  it('catalog entries win over the custom type map', () => {
    // Plank is `timed` in the catalog. Even if the user labels it 'weighted',
    // the catalog wins so engine math stays consistent for known exercises.
    const typer = createExerciseTyper({ Plank: 'weighted' });
    expect(typer('Plank')).toBe('timed');
  });

  it('falls back to the legacy fallback map before defaulting to weighted', () => {
    const typer = createExerciseTyper();
    // "Pull Ups" (with space) is in the fallback map.
    expect(typer('Pull Ups')).toBe('bodyweight');
  });

  it("defaults unknown names with no custom entry to 'weighted'", () => {
    const typer = createExerciseTyper();
    expect(typer('Some Made Up Exercise')).toBe('weighted');
  });
});

describe('DEFAULT_CARDIO_POOL', () => {
  it('contains exactly the timed cardio entries with no lift affinity', () => {
    expect(DEFAULT_CARDIO_POOL).toEqual([
      'Row Machine',
      'Ski Erg',
      'Run - Treadmill',
      'Run - Outside',
    ]);
  });

  it('excludes core-flagged timed exercises (e.g. Plank)', () => {
    expect(DEFAULT_CARDIO_POOL).not.toContain('Plank');
  });
});
