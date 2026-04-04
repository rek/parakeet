import { DEFAULT_AUXILIARY_POOLS } from '@parakeet/training-engine';
import type { Lift } from '@parakeet/shared-types';

/**
 * Returns all auxiliary exercises from the affected lifts' default pools.
 * Used in the disruption report screen to let users mark which exercises
 * they can still safely perform despite an injury.
 */
export function getSafeExerciseCandidates(lifts: string[]): string[] {
  const exercises = new Set<string>();
  for (const lift of lifts) {
    const pool = DEFAULT_AUXILIARY_POOLS[lift as Lift];
    if (pool) {
      for (const e of pool) exercises.add(e);
    }
  }
  return Array.from(exercises);
}
