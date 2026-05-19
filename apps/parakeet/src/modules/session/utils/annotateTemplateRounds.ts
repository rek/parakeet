// @spec docs/features/workout-templates/spec-insertion.md
import type { AuxiliaryActualSet } from '../store/sessionStore';

export interface AnnotatedTemplateEntry {
  entry: AuxiliaryActualSet;
  /** 1-based round number within the template block. */
  round: number;
  /** Total rounds in the block (max occurrences of any exercise). */
  totalRounds: number;
  /** Highest set_number for this exercise across the *entire* session, not
   *  just the block. Used to gate the "is this the last set, suppress rest"
   *  check downstream — a template-block exercise that overlaps with prior
   *  ad-hoc sets has a higher global total than the block alone shows. */
  setsInExercise: number;
}

/**
 * Annotates each entry in a template block with its round number, the block's
 * total round count, and the exercise's session-wide set total.
 *
 * `block` MUST contain only entries sharing one `template_instance_id`,
 * ordered as expanded (round-by-round). `auxiliarySets` is the full
 * session-wide aux array, used to compute `setsInExercise` correctly when
 * the same exercise also appears outside the block.
 *
 * v1 contract: every exercise appears at most once per round inside a single
 * template. The round counter is derived from per-exercise occurrence index
 * within the block; duplicates would break the badge math.
 */
export function annotateTemplateRounds(
  block: ReadonlyArray<AuxiliaryActualSet>,
  auxiliarySets: ReadonlyArray<AuxiliaryActualSet>
): AnnotatedTemplateEntry[] {
  if (block.length === 0) return [];

  const perExerciseSeen = new Map<string, number>();
  const perExerciseInBlock = new Map<string, number>();
  for (const e of block) {
    perExerciseInBlock.set(
      e.exercise,
      (perExerciseInBlock.get(e.exercise) ?? 0) + 1
    );
  }
  const totalRounds = Math.max(...perExerciseInBlock.values());

  // Exercise-global highest set_number — covers both the block and any
  // pre-existing ad-hoc / JIT-prescribed sets for the same exercise.
  const globalTotalByExercise = new Map<string, number>();
  for (const s of auxiliarySets) {
    globalTotalByExercise.set(
      s.exercise,
      Math.max(globalTotalByExercise.get(s.exercise) ?? 0, s.set_number)
    );
  }

  return block.map((entry) => {
    const seen = (perExerciseSeen.get(entry.exercise) ?? 0) + 1;
    perExerciseSeen.set(entry.exercise, seen);
    return {
      entry,
      round: seen,
      totalRounds,
      setsInExercise:
        globalTotalByExercise.get(entry.exercise) ?? entry.set_number,
    };
  });
}
