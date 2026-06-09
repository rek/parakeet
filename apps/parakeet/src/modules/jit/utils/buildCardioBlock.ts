import { DEFAULT_CARDIO_POOL } from '@parakeet/training-engine';
import type { JITOutput } from '@parakeet/training-engine';

/** A single appended cardio entry mirrors the engine's auxiliary work shape. */
type CardioWork = JITOutput['auxiliaryWork'][number];

/** Duration choices surfaced on the check-in toggle (minutes). */
export const CARDIO_DURATION_OPTIONS_MIN = [10, 15, 20] as const;

/** Prescribed minutes when the lifter enables cardio without picking a length. */
export const DEFAULT_CARDIO_DURATION_MIN = 10;

const MIN_CARDIO_MINUTES = 1;
const MAX_CARDIO_MINUTES = 90;

function clampDurationMin(durationMin?: number): number {
  if (durationMin == null || !Number.isFinite(durationMin)) {
    return DEFAULT_CARDIO_DURATION_MIN;
  }
  const rounded = Math.round(durationMin);
  return Math.min(MAX_CARDIO_MINUTES, Math.max(MIN_CARDIO_MINUTES, rounded));
}

interface BuildCardioBlockOptions {
  /** Configured cardio modalities for the lifter; falls back to the engine
   *  default pool when empty/omitted. */
  cardioPool?: readonly string[];
  /** Recently-prescribed aux exercises — used to rotate modality so the same
   *  machine isn't suggested every session. */
  recentAuxExercises?: readonly string[];
  /** Prescribed cardio length in minutes (clamped to 1..90). */
  durationMin?: number;
}

/**
 * Builds an optional cardio block to append to a session's auxiliary work.
 *
 * This is deliberately non-adaptive: cardio is additive and intentionally does
 * NOT touch volume/recovery accounting (timed exercises are already excluded
 * from volume top-up scoring in the engine). The prescribed minutes ride on the
 * set's `reps` field, which the timed `SetRow` renders as the "min" placeholder.
 *
 * Returns `null` when no cardio modality is available.
 */
export function buildCardioBlock(
  opts: BuildCardioBlockOptions = {}
): CardioWork | null {
  const pool =
    opts.cardioPool && opts.cardioPool.length > 0
      ? opts.cardioPool
      : DEFAULT_CARDIO_POOL;
  if (pool.length === 0) return null;

  const recent = new Set(opts.recentAuxExercises ?? []);
  // Prefer a modality not done recently; fall back to the first in the pool.
  const exercise = pool.find((e) => !recent.has(e)) ?? pool[0];
  const durationMin = clampDurationMin(opts.durationMin);

  return {
    exercise,
    exerciseType: 'timed',
    sets: [{ set_number: 1, weight_kg: 0, reps: durationMin }],
    skipped: false,
  };
}
