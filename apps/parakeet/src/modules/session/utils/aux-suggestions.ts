// @spec docs/features/session/spec-adhoc.md
import type { Lift } from '@parakeet/shared-types';
import type {
  ExerciseCatalogEntry,
  MuscleGroup,
} from '@parakeet/training-engine';

/**
 * Returns up to `maxResults` exercise names from the catalog that complement
 * the current session, sorted by how many uncovered muscles they add.
 *
 * - Filters to exercises with the same `associatedLift` as `primaryLift`
 *   (or all exercises if `primaryLift` is null).
 * - Excludes exercises already in the session (`existingExercises`).
 * - Prioritises exercises that cover muscles not yet trained this session.
 */
export function computeSuggestedAux(
  primaryLift: Lift | null,
  existingExercises: string[],
  catalog: ExerciseCatalogEntry[],
  maxResults = 5
): string[] {
  const existingSet = new Set(existingExercises);

  // Collect muscles already covered by existing exercises
  const coveredMuscles = new Set<MuscleGroup>();
  for (const name of existingExercises) {
    const entry = catalog.find((e) => e.name === name);
    if (entry) {
      for (const m of entry.primaryMuscles) {
        coveredMuscles.add(m);
      }
    }
  }

  // Filter catalog to same-lift exercises not already in session
  const candidates = catalog.filter((e) => {
    if (existingSet.has(e.name)) return false;
    if (primaryLift) return e.associatedLift === primaryLift;
    return true;
  });

  // Score: number of uncovered muscles this exercise adds
  const scored = candidates.map((e) => {
    const uncovered = e.primaryMuscles.filter(
      (m) => !coveredMuscles.has(m)
    ).length;
    return { name: e.name, uncovered };
  });

  // Sort descending by uncovered muscle count, then alphabetically for stability
  scored.sort(
    (a, b) => b.uncovered - a.uncovered || a.name.localeCompare(b.name)
  );

  return scored.slice(0, maxResults).map((s) => s.name);
}

/**
 * Returns a suggested initial weight in grams for an exercise, rounded to the
 * nearest 500g. Returns 0 for bodyweight/timed exercises or if the exercise is
 * not in the catalog.
 */
export function computeSuggestedWeight(
  exerciseName: string,
  oneRmGrams: number,
  catalog: ExerciseCatalogEntry[]
): number {
  const entry = catalog.find((e) => e.name === exerciseName);
  if (!entry || entry.type === 'bodyweight' || entry.type === 'timed') return 0;
  const weightPct = entry.weightPct ?? 0.675;
  return Math.round((oneRmGrams * weightPct) / 500) * 500;
}
