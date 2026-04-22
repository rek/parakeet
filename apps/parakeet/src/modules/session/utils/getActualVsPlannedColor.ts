// @spec docs/features/session/spec-performance.md
import type { ActualSet, PlannedSet } from '@parakeet/shared-types';
import { weightGramsToKg } from '@shared/utils/weight';

const WEIGHT_MATCH_TOLERANCE_KG = 0.1;

/**
 * Returns a color key indicating how actual performance compared to plan.
 *
 * 'neutral' = no plan, mixed, or matched; 'under' = below plan; 'over' = above plan
 */
export function getActualVsPlannedColor({
  actual,
  planned,
}: {
  actual: ActualSet;
  planned: PlannedSet | undefined;
}): 'neutral' | 'under' | 'over' {
  if (!planned) return 'neutral';
  const actualKg = weightGramsToKg(actual.weight_grams);
  const weightOver = actualKg > planned.weight_kg + WEIGHT_MATCH_TOLERANCE_KG;
  const weightUnder = actualKg < planned.weight_kg - WEIGHT_MATCH_TOLERANCE_KG;
  const repsOver = actual.reps_completed > planned.reps;
  const repsUnder = actual.reps_completed < planned.reps;
  // Mixed (heavier but fewer reps, or lighter but more) → neutral
  if ((weightOver && repsUnder) || (weightUnder && repsOver)) return 'neutral';
  if (weightUnder || repsUnder) return 'under';
  if (weightOver || repsOver) return 'over';
  return 'neutral';
}
