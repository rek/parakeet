// @spec docs/features/workout-templates/spec-insertion.md
import type { AuxiliaryActualSet } from '../store/sessionStore';

/**
 * Returns the rest duration (seconds) to use after an aux set. Template-derived
 * sets carry a `prescribed_rest_seconds` override that wins over the user's
 * global RestTimerPrefs default; everything else falls back to `fallback`.
 *
 * Template entries within one exercise all share the same prescribed value, so
 * looking up by the just-completed or about-to-start set number both yield the
 * same answer — pick whichever set_number the caller has on hand.
 */
export function resolveAuxRestSeconds(opts: {
  exercise: string;
  setNumber: number;
  auxiliarySets: ReadonlyArray<AuxiliaryActualSet>;
  fallback: number;
}): number {
  const { exercise, setNumber, auxiliarySets, fallback } = opts;
  const match = auxiliarySets.find(
    (s) => s.exercise === exercise && s.set_number === setNumber
  );
  return match?.prescribed_rest_seconds ?? fallback;
}
