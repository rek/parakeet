import { describe, expect, it } from 'vitest';

import { MuscleGroup } from '../types';
import { EXERCISE_CATALOG } from './exercise-catalog';
import {
  ExerciseScoringContext,
  rankExercises,
  scoreExercise,
} from './exercise-scorer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseCtx(
  overrides?: Partial<ExerciseScoringContext>
): ExerciseScoringContext {
  return {
    targetMuscle: 'quads',
    muscleDeficits: { quads: 4 },
    sorenessRatings: {},
    primaryLift: 'squat',
    mainLiftSetCount: 5,
    alreadySelectedPatterns: [],
    alreadySelectedExercises: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Per-factor isolation tests
// ---------------------------------------------------------------------------

describe('exercise-scorer / deficit coverage', () => {
  it('scores higher for exercises with secondary deficit coverage', () => {
    const ctx = baseCtx({
      targetMuscle: 'quads',
      muscleDeficits: { quads: 4, glutes: 3, hamstrings: 2 },
    });
    // Bulgarian Split Squat: quads 1.0, glutes 1.0, hamstrings 0.5 — has deficit secondaries
    const rich = scoreExercise('Bulgarian Split Squat', ctx);
    // Leg Press: quads 1.0, glutes 0.5 — less secondary coverage
    const lean = scoreExercise('Leg Press', ctx);
    expect(rich.breakdown.deficit).toBeGreaterThan(lean.breakdown.deficit);
  });

  it('gives base 0.5 when no secondary deficits exist', () => {
    const ctx = baseCtx({ muscleDeficits: { quads: 4 } });
    const result = scoreExercise('Leg Press', ctx);
    expect(result.breakdown.deficit).toBe(0.5);
  });
});

describe('exercise-scorer / soreness avoidance', () => {
  it('penalizes exercises touching sore muscles', () => {
    const ctx = baseCtx({
      targetMuscle: 'quads',
      sorenessRatings: { glutes: 4 as 4 },
    });
    // Bulgarian Split Squat hits glutes at 1.0 — penalized
    const sore = scoreExercise('Bulgarian Split Squat', ctx);
    // Leg Press hits glutes at 0.5 — less penalized
    const less = scoreExercise('Leg Press', ctx);
    expect(sore.breakdown.soreness).toBeLessThan(less.breakdown.soreness);
  });

  it('returns 1.0 with no soreness', () => {
    const ctx = baseCtx({ sorenessRatings: {} });
    const result = scoreExercise('Leg Press', ctx);
    expect(result.breakdown.soreness).toBe(1.0);
  });
});

describe('exercise-scorer / movement pattern diversity', () => {
  it('penalizes repeated patterns', () => {
    const ctx = baseCtx({ alreadySelectedPatterns: ['squat'] });
    // Pause Squat resolves to 'squat' pattern (associatedLift = squat)
    const repeated = scoreExercise('Pause Squat', ctx);
    expect(repeated.breakdown.diversity).toBe(0.3);
  });

  it('rewards novel patterns', () => {
    const ctx = baseCtx({ alreadySelectedPatterns: ['push'] });
    // Pause Squat resolves to 'squat' — novel when only 'push' used so far
    const novel = scoreExercise('Pause Squat', ctx);
    expect(novel.breakdown.diversity).toBe(1.0);
  });
});

describe('exercise-scorer / fatigue appropriateness', () => {
  it('prefers simple exercises when readiness is poor', () => {
    const ctx = baseCtx({
      targetMuscle: 'upper_back',
      muscleDeficits: { upper_back: 4 },
      primaryLift: 'deadlift',
      sleepQuality: 1,
      energyLevel: 1,
    });
    // Lat Pulldown: simple. Power Clean: complex
    const simple = scoreExercise('Lat Pulldown', ctx);
    const complex = scoreExercise('Power Clean', ctx);
    expect(simple.breakdown.fatigue).toBeGreaterThan(complex.breakdown.fatigue);
  });

  it('prefers complex exercises when readiness is great', () => {
    const ctx = baseCtx({
      targetMuscle: 'upper_back',
      muscleDeficits: { upper_back: 4 },
      primaryLift: 'deadlift',
      sleepQuality: 3,
      energyLevel: 3,
    });
    const simple = scoreExercise('Lat Pulldown', ctx);
    const complex = scoreExercise('Power Clean', ctx);
    expect(complex.breakdown.fatigue).toBeGreaterThan(simple.breakdown.fatigue);
  });
});

describe('exercise-scorer / upcoming lift protection', () => {
  it('penalizes exercises overlapping with upcoming lift muscles', () => {
    const ctx = baseCtx({
      targetMuscle: 'chest',
      muscleDeficits: { chest: 4 },
      primaryLift: 'squat',
      upcomingLifts: ['bench'],
    });
    // Close-Grip Barbell Bench Press: chest + triceps — overlaps bench muscles
    const overlap = scoreExercise('Close-Grip Barbell Bench Press', ctx);
    expect(overlap.breakdown.upcoming).toBeLessThan(1.0);
  });

  it('returns 1.0 when no upcoming lifts', () => {
    const ctx = baseCtx({ upcomingLifts: [] });
    const result = scoreExercise('Pause Squat', ctx);
    expect(result.breakdown.upcoming).toBe(1.0);
  });

  it('clamps to 0 with heavy multi-muscle overlap', () => {
    const ctx = baseCtx({
      targetMuscle: 'quads',
      muscleDeficits: { quads: 4 },
      primaryLift: 'bench',
      // Squat + deadlift upcoming: quads, hams, glutes, lower_back, upper_back all overlap
      upcomingLifts: ['squat', 'deadlift'],
    });
    // Pause Squat: quads 1.0, glutes 1.0, hams 0.5, lower_back 0.5 — many overlaps
    const result = scoreExercise('Pause Squat', ctx);
    expect(result.breakdown.upcoming).toBe(0);
  });
});

describe('exercise-scorer / specificity', () => {
  it('prefers same-lift exercises', () => {
    const ctx = baseCtx({ primaryLift: 'squat' });
    const same = scoreExercise('Pause Squat', ctx); // associatedLift: squat
    const general = scoreExercise('Overhead Press', ctx); // associatedLift: null
    const cross = scoreExercise('Close-Grip Barbell Bench Press', ctx); // associatedLift: bench
    expect(same.breakdown.specific).toBeGreaterThan(general.breakdown.specific);
    expect(general.breakdown.specific).toBeGreaterThan(
      cross.breakdown.specific
    );
  });
});

describe('exercise-scorer / compound-isolation balance', () => {
  it('prefers isolation when already-selected are compound', () => {
    const ctx = baseCtx({
      targetMuscle: 'chest',
      muscleDeficits: { chest: 4 },
      primaryLift: 'bench',
      alreadySelectedExercises: [
        'Close-Grip Barbell Bench Press',
        'Barbell Pause Bench Press',
      ],
    });
    // Dumbbell Fly: isCompound=false (explicit)
    const isolation = scoreExercise('Dumbbell Fly', ctx);
    // Floor Press: compound (2 muscles at 1.0)
    const compound = scoreExercise('Floor Press', ctx);
    expect(isolation.breakdown.balance).toBeGreaterThan(
      compound.breakdown.balance
    );
  });

  it('prefers compound when already-selected are isolation', () => {
    const ctx = baseCtx({
      targetMuscle: 'chest',
      muscleDeficits: { chest: 4 },
      primaryLift: 'bench',
      alreadySelectedExercises: ['Dumbbell Fly', 'Barbell Curl'],
    });
    const compound = scoreExercise('Floor Press', ctx);
    const isolation = scoreExercise('Dumbbell Fly', ctx);
    expect(compound.breakdown.balance).toBeGreaterThan(
      isolation.breakdown.balance
    );
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('exercise-scorer / edge cases', () => {
  it('handles unknown exercise gracefully (fallback scores)', () => {
    const ctx = baseCtx();
    const result = scoreExercise('Totally Made Up Exercise', ctx);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    // Factors that depend on catalog entry fall back to 0.5
    expect(result.breakdown.diversity).toBe(0.5);
    expect(result.breakdown.fatigue).toBe(0.5);
    expect(result.breakdown.specific).toBe(0.5);
    expect(result.breakdown.balance).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Invariant tests
// ---------------------------------------------------------------------------

describe('exercise-scorer / invariants', () => {
  const allWeighted = EXERCISE_CATALOG.filter((e) => e.type === 'weighted').map(
    (e) => e.name
  );

  it('score is always in [0, 1]', () => {
    for (const name of allWeighted) {
      const ctx = baseCtx({
        targetMuscle: 'quads',
        muscleDeficits: { quads: 4, hamstrings: 3, glutes: 2 },
        sorenessRatings: { hamstrings: 3 as 3 },
        sleepQuality: 1,
        energyLevel: 2,
        alreadySelectedPatterns: ['squat'],
        alreadySelectedExercises: ['Pause Squat'],
        upcomingLifts: ['bench'],
      });
      const result = scoreExercise(name, ctx);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });

  it('rankExercises returns sorted descending', () => {
    const ctx = baseCtx({
      targetMuscle: 'quads',
      muscleDeficits: { quads: 4, glutes: 3 },
    });
    const squat = EXERCISE_CATALOG.filter(
      (e) => e.associatedLift === 'squat'
    ).map((e) => e.name);
    const ranked = rankExercises(squat, ctx);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it('breakdown sub-scores × weights ≈ total score', () => {
    const weights: Record<string, number> = {
      deficit: 0.3,
      soreness: 0.25,
      diversity: 0.15,
      fatigue: 0.1,
      upcoming: 0.1,
      specific: 0.05,
      balance: 0.05,
    };
    for (const name of allWeighted.slice(0, 20)) {
      const ctx = baseCtx({
        muscleDeficits: { quads: 4, hamstrings: 3 },
        sorenessRatings: { glutes: 2 as 2 },
        upcomingLifts: ['bench'],
      });
      const result = scoreExercise(name, ctx);
      let expected = 0;
      for (const [key, w] of Object.entries(weights)) {
        expected += w * (result.breakdown[key] ?? 0);
      }
      expect(result.score).toBeCloseTo(expected, 10);
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario tests
// ---------------------------------------------------------------------------

describe('exercise-scorer / scenarios', () => {
  it('squat day, hams sore, quads below MEV → prefers quad-dominant non-sore exercise', () => {
    const ctx = baseCtx({
      targetMuscle: 'quads',
      muscleDeficits: { quads: 5 },
      sorenessRatings: { hamstrings: 4 as 4 },
      primaryLift: 'squat',
    });
    const candidates = ['Bulgarian Split Squat', 'Leg Press', 'Hack Squat'];
    const ranked = rankExercises(candidates, ctx);
    // Leg Press and Hack Squat hit quads (1.0) + glutes (0.5), not hamstrings
    // Bulgarian Split Squat hits hamstrings at 0.5 → penalized by soreness
    expect(ranked[0].exercise).not.toBe('Bulgarian Split Squat');
  });

  it('low readiness + bench tomorrow → prefers simple exercise avoiding chest', () => {
    const ctx = baseCtx({
      targetMuscle: 'upper_back',
      muscleDeficits: { upper_back: 4 },
      primaryLift: 'deadlift',
      sleepQuality: 1,
      energyLevel: 1,
      upcomingLifts: ['bench'],
    });
    const candidates = ['Lat Pulldown', 'Power Clean', 'Barbell Hang Clean'];
    const ranked = rankExercises(candidates, ctx);
    // Lat Pulldown: simple + pull pattern. Power Clean/Hang Clean: complex
    expect(ranked[0].exercise).toBe('Lat Pulldown');
  });

  it('two squat-pattern exercises already → prefers hinge or pull pattern', () => {
    const ctx = baseCtx({
      targetMuscle: 'hamstrings',
      muscleDeficits: { hamstrings: 3 },
      primaryLift: 'squat',
      alreadySelectedPatterns: ['squat', 'squat'],
    });
    const candidates = ['Kettlebell Swing', 'Good Mornings'];
    const ranked = rankExercises(candidates, ctx);
    // Both are hinge pattern (deadlift-associated) → both get diversity=1.0
    // Neither is squat pattern, so both benefit from diversity
    for (const r of ranked) {
      expect(r.breakdown.diversity).toBe(1.0);
    }
  });
});
