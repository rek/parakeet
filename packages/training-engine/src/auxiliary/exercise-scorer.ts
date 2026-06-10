import { Lift } from '@parakeet/shared-types';

import { ReadinessLevel } from '../adjustments/readiness-adjuster';
import { SorenessLevel } from '../adjustments/soreness-adjuster';
import { MuscleGroup, MuscleMapper } from '../types';
import {
  ComplexityTier,
  getCatalogEntry,
  MovementPattern,
  resolveComplexityTier,
  resolveIsCompound,
  resolveMovementPattern,
} from './exercise-catalog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExerciseScoringContext {
  /** The muscle this top-up is trying to fill. */
  targetMuscle: MuscleGroup;
  /** All muscle deficits (muscle → sets below MEV). */
  muscleDeficits: Partial<Record<MuscleGroup, number>>;

  /** Per-muscle soreness (1–10). */
  sorenessRatings: Partial<Record<MuscleGroup, SorenessLevel>>;
  /** Sleep quality (1=poor, 2=ok, 3=great). */
  sleepQuality?: ReadinessLevel;
  /** Energy level (1=low, 2=normal, 3=high). */
  energyLevel?: ReadinessLevel;

  /** Today's primary lift. */
  primaryLift: Lift;
  /** Sets from today's main lift. */
  mainLiftSetCount: number;
  /** Lifts scheduled later this week. */
  upcomingLifts?: Lift[];
  /** Movement patterns already selected in this session (for diversity). */
  alreadySelectedPatterns: MovementPattern[];
  /** Exercise names already selected (for compound/isolation balance). */
  alreadySelectedExercises: string[];

  /** Exercise names from recent sessions, ordered newest-first. Drives the
   *  recency-penalty factor so the same core/aux exercise isn't chosen every
   *  session when no other signal distinguishes the candidates (GH#211).
   *  Recommended: last 3 sessions' aux + top-up exercises. */
  recentAuxExercises?: string[];

  biologicalSex?: 'female' | 'male';

  /** Resolves an exercise to its muscle contributions. Includes the user's
   *  custom muscle map when built via createMuscleMapper. */
  muscleMapper: MuscleMapper;
}

export interface ScoredExercise {
  exercise: string;
  score: number;
  breakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Weights — sum to 1.0
// ---------------------------------------------------------------------------

const W_DEFICIT = 0.28;
const W_SORENESS = 0.22;
const W_DIVERSITY = 0.13;
const W_RECENCY = 0.1;
const W_FATIGUE = 0.09;
const W_UPCOMING = 0.09;
const W_SPECIFIC = 0.05;
const W_BALANCE = 0.04;

// ---------------------------------------------------------------------------
// Scoring factors (each returns [0, 1])
// ---------------------------------------------------------------------------

/**
 * Muscle deficit coverage: base 0.5 (exercise qualifies for target muscle),
 * plus bonus for secondary muscles that also have deficits.
 */
function scoreDeficitCoverage(
  exercise: string,
  ctx: ExerciseScoringContext
): number {
  const muscles = ctx.muscleMapper(null, exercise);
  const deficits = ctx.muscleDeficits;
  const maxDeficit = Math.max(
    1,
    ...Object.values(deficits).filter((d): d is number => d != null && d > 0)
  );

  let bonus = 0;
  let secondaryCount = 0;
  for (const { muscle, contribution } of muscles) {
    if (muscle === ctx.targetMuscle) continue;
    const deficit = deficits[muscle];
    if (deficit != null && deficit > 0) {
      bonus += contribution * Math.min(deficit / maxDeficit, 1.0);
      secondaryCount++;
    }
  }
  // Normalize bonus: cap at 1.0
  const normalizedBonus =
    secondaryCount > 0 ? Math.min(bonus / secondaryCount, 1.0) : 0;
  return 0.5 + 0.5 * normalizedBonus;
}

/**
 * Soreness avoidance: penalize exercises that touch sore muscles.
 * Each muscle contribution × (sorenessLevel / 10) is accumulated as penalty.
 */
function scoreSorenessAvoidance(
  exercise: string,
  ctx: ExerciseScoringContext
): number {
  const muscles = ctx.muscleMapper(null, exercise);
  let penalty = 0;
  for (const { muscle, contribution } of muscles) {
    const soreness = ctx.sorenessRatings[muscle];
    if (soreness != null && soreness > 1) {
      penalty += contribution * (soreness / 10);
    }
  }
  return Math.max(0, 1.0 - penalty);
}

/**
 * Movement pattern diversity: 1.0 if novel pattern, 0.3 if already used.
 */
function scorePatternDiversity(
  exercise: string,
  ctx: ExerciseScoringContext
): number {
  const entry = getCatalogEntry(exercise);
  if (!entry) return 0.5;
  const pattern = resolveMovementPattern(entry);
  return ctx.alreadySelectedPatterns.includes(pattern) ? 0.3 : 1.0;
}

/**
 * Fatigue appropriateness: match exercise complexity to readiness.
 * Poor readiness → prefer simple. Great readiness → slight compound preference.
 */
function scoreFatigueAppropriate(
  exercise: string,
  ctx: ExerciseScoringContext
): number {
  const entry = getCatalogEntry(exercise);
  if (!entry) return 0.5;
  const tier = resolveComplexityTier(entry);

  const sleep = ctx.sleepQuality ?? 3;
  const energy = ctx.energyLevel ?? 3;
  const readiness = (sleep + energy) / 2; // 1–5 native, 3 = neutral midpoint

  return complexityReadinessScore(tier, readiness);
}

function complexityReadinessScore(
  tier: ComplexityTier,
  readiness: number
): number {
  // 1-5 scale, 3 = neutral. Bands:
  //   poor   (<= 2.5): simple=1.0, moderate=0.5, complex=0.2
  //   neutral (2.5 – 3.5): all=0.7
  //   great  (>= 3.5): simple=0.6, moderate=0.8, complex=1.0
  if (readiness <= 2.5) {
    if (tier === 'simple') return 1.0;
    if (tier === 'moderate') return 0.5;
    return 0.2;
  }
  if (readiness >= 3.5) {
    if (tier === 'simple') return 0.6;
    if (tier === 'moderate') return 0.8;
    return 1.0;
  }
  return 0.7;
}

/**
 * Upcoming lift protection: penalize exercises that fatigue muscles
 * needed for lifts later this week.
 */
function scoreUpcomingProtection(
  exercise: string,
  ctx: ExerciseScoringContext
): number {
  if (!ctx.upcomingLifts?.length) return 1.0;
  const exerciseMuscles = ctx.muscleMapper(null, exercise);
  const upcomingMuscles = new Set<MuscleGroup>();
  for (const lift of ctx.upcomingLifts) {
    for (const { muscle } of ctx.muscleMapper(lift)) {
      upcomingMuscles.add(muscle);
    }
  }
  let overlapCount = 0;
  for (const { muscle, contribution } of exerciseMuscles) {
    if (contribution >= 0.5 && upcomingMuscles.has(muscle)) {
      overlapCount++;
    }
  }
  return Math.max(0, 1.0 - 0.4 * overlapCount);
}

/**
 * Main lift specificity: prefer exercises associated with the same lift.
 */
function scoreSpecificity(
  exercise: string,
  ctx: ExerciseScoringContext
): number {
  const entry = getCatalogEntry(exercise);
  if (!entry) return 0.5;
  if (entry.associatedLift === ctx.primaryLift) return 1.0;
  if (entry.associatedLift === null) return 0.6;
  return 0.3;
}

/**
 * Recency penalty: exercises used in recent sessions score lower so the
 * rotation visibly cycles instead of locking onto a single deterministic
 * winner (GH#211 — "don't pick Dragon Flag every session"). The penalty
 * decays linearly with recency rank: most-recent = 0.2, then 0.4, 0.6,
 * 0.8, and clears to 1.0 beyond the recent window. Empty / undefined
 * recent list returns the neutral 1.0.
 */
function scoreRecency(exercise: string, ctx: ExerciseScoringContext): number {
  const recent = ctx.recentAuxExercises;
  if (!recent || recent.length === 0) return 1.0;
  const idx = recent.indexOf(exercise);
  if (idx === -1) return 1.0;
  // newest entry (idx 0) → heaviest penalty; fades by index.
  // 0 → 0.2, 1 → 0.4, 2 → 0.6, 3 → 0.8, ≥4 → 1.0.
  return Math.min(1.0, 0.2 + idx * 0.2);
}

/**
 * Compound/isolation balance: if already-selected exercises lean one way,
 * prefer the other.
 */
function scoreCompoundBalance(
  exercise: string,
  ctx: ExerciseScoringContext
): number {
  const entry = getCatalogEntry(exercise);
  if (!entry) return 0.5;
  const isCompound = resolveIsCompound(entry);

  const selected = ctx.alreadySelectedExercises;
  if (selected.length === 0) return 0.7;

  let compounds = 0;
  for (const name of selected) {
    const e = getCatalogEntry(name);
    if (e && resolveIsCompound(e)) compounds++;
  }
  const compoundRatio = compounds / selected.length;

  // If mostly compound (>60%), prefer isolation
  if (compoundRatio > 0.6) return isCompound ? 0.3 : 1.0;
  // If mostly isolation (<40%), prefer compound
  if (compoundRatio < 0.4) return isCompound ? 1.0 : 0.3;
  // Balanced
  return 0.7;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scoreExercise(
  exercise: string,
  ctx: ExerciseScoringContext
): ScoredExercise {
  const deficit = scoreDeficitCoverage(exercise, ctx);
  const soreness = scoreSorenessAvoidance(exercise, ctx);
  const diversity = scorePatternDiversity(exercise, ctx);
  const recency = scoreRecency(exercise, ctx);
  const fatigue = scoreFatigueAppropriate(exercise, ctx);
  const upcoming = scoreUpcomingProtection(exercise, ctx);
  const specific = scoreSpecificity(exercise, ctx);
  const balance = scoreCompoundBalance(exercise, ctx);

  const score =
    W_DEFICIT * deficit +
    W_SORENESS * soreness +
    W_DIVERSITY * diversity +
    W_RECENCY * recency +
    W_FATIGUE * fatigue +
    W_UPCOMING * upcoming +
    W_SPECIFIC * specific +
    W_BALANCE * balance;

  return {
    exercise,
    score,
    breakdown: {
      deficit,
      soreness,
      diversity,
      recency,
      fatigue,
      upcoming,
      specific,
      balance,
    },
  };
}

export function rankExercises(
  candidates: string[],
  ctx: ExerciseScoringContext
): ScoredExercise[] {
  return candidates
    .map((exercise) => scoreExercise(exercise, ctx))
    .sort((a, b) => b.score - a.score);
}
