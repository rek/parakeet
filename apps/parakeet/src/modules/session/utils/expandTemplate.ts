// @spec docs/features/workout-templates/spec-insertion.md
import type {
  WorkoutTemplate,
  WorkoutTemplateItem,
} from '@modules/workout-templates';
import { getCatalogEntry } from '@parakeet/training-engine';

import type { AuxiliaryActualSet } from '../store/sessionStore';

/** Generates a short opaque id for grouping template-derived aux entries. The
 *  id never leaves the zustand store (no DB column), so cryptographic
 *  uniqueness isn't required — temporal + random is enough. */
function generateTemplateInstanceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ExpandTemplateOptions {
  /** Optional resolver to seed a suggested weight for weighted entries.
   *  Pass `computeSuggestedWeight` bound to the lifter's 1RM + catalog from
   *  the caller. Returning 0 (or omitting this option) leaves weight_grams=0
   *  and the lifter enters weight manually per set. */
  computeWeightGrams?: (exercise: string) => number;
}

/**
 * Expands a template into a flat sequence of aux entries, round by round.
 * Pure function — does no zustand reads or DB calls. Caller passes the
 * result to `useSessionStore().addTemplateBlock`, which assigns set_numbers
 * relative to any existing sets for each exercise.
 *
 * Ordering: for each round r in 1..rounds, items appear in position order.
 * Example: items [A, B, C] × rounds 5 → A1, B1, C1, A2, B2, C2, ..., A5, B5, C5.
 */
export function expandTemplate(
  template: Pick<WorkoutTemplate, 'rounds' | 'name'>,
  items: ReadonlyArray<WorkoutTemplateItem>,
  opts: ExpandTemplateOptions = {}
): Omit<AuxiliaryActualSet, 'set_number'>[] {
  const templateInstanceId = generateTemplateInstanceId();
  const sorted = [...items].sort((a, b) => a.position - b.position);

  // v1 contract: an exercise must appear at most once per round. AuxTemplateBlock's
  // round-counter derivation (per-exercise occurrence index) and the
  // session-global setsInExercise gate both depend on this. If a future
  // template needs the same exercise twice per round, both the round badge
  // math and the rest-timer "last set" check need rework first.
  const seen = new Set<string>();
  for (const item of sorted) {
    if (seen.has(item.exercise)) {
      throw new Error(
        `expandTemplate: duplicate exercise "${item.exercise}" in template "${template.name}". An exercise may appear at most once per round.`
      );
    }
    seen.add(item.exercise);
  }

  const entries: Omit<AuxiliaryActualSet, 'set_number'>[] = [];

  for (let round = 0; round < template.rounds; round++) {
    for (const item of sorted) {
      const catalog = getCatalogEntry(item.exercise);
      const isTimed = catalog?.type === 'timed';
      const isWeighted = catalog?.type === 'weighted';
      const weight_grams =
        isWeighted && opts.computeWeightGrams
          ? opts.computeWeightGrams(item.exercise)
          : 0;
      entries.push({
        exercise: item.exercise,
        weight_grams,
        reps_completed: isTimed ? 0 : (item.reps ?? 0),
        is_completed: false,
        exercise_type: catalog?.type,
        prescribed_rest_seconds: item.rest_after_seconds,
        template_instance_id: templateInstanceId,
        template_name: template.name,
      });
    }
  }

  return entries;
}
