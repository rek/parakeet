import type { ActualSet } from '@parakeet/shared-types';

/**
 * Groups auxiliary actual sets by exercise name for read-only display.
 *
 * Unlike `groupAuxiliaryWork` (which serves the active session with
 * regular/topUp splits), this is a simple name-based grouping for
 * the history detail view.
 */
export function groupAuxSetsByExercise({ sets }: { sets: ActualSet[] }) {
  return sets.reduce<Record<string, ActualSet[]>>((acc, set) => {
    const name = set.exercise ?? 'Auxiliary';
    if (!acc[name]) acc[name] = [];
    acc[name].push(set);
    return acc;
  }, {});
}
