// @spec docs/features/auxiliary-exercises/spec-history-anchored-weight.md
import { roundToNearest } from '@shared/utils/weight';

import type { AuxiliaryWork } from '../model/types';

/** Show the note when anchor base diverges from formula by more than this. */
export const DIVERGENCE_THRESHOLD = 0.2;

/**
 * Pure decision function for whether the anchor note should be visible.
 * Extracted so it can be unit-tested without rendering. Returns false when:
 *   - source is 'formula' (anchor not in play)
 *   - formula weight is non-positive (bodyweight / timed exercises)
 *   - divergence ratio is within DIVERGENCE_THRESHOLD
 *   - plate rounding swallows the difference (hysteresis)
 *
 * Compares `anchorBaseKg` (pre-modifier anchor) to `formulaWeightKg` —
 * NOT the final prescribed weight — so main-lift modifier shrinkage on a
 * heavy/sore day doesn't get misattributed to recent history in the note.
 */
export function shouldShowAnchorNote({
  anchor,
  weightIncrementKg,
}: {
  anchor: NonNullable<AuxiliaryWork['anchor']>;
  weightIncrementKg: number;
}): boolean {
  if (anchor.source === 'formula') return false;
  if (anchor.formulaWeightKg <= 0) return false;
  const divergence =
    Math.abs(anchor.anchorBaseKg - anchor.formulaWeightKg) /
    anchor.formulaWeightKg;
  if (divergence <= DIVERGENCE_THRESHOLD) return false;
  const incr = weightIncrementKg > 0 ? weightIncrementKg : 2.5;
  if (
    roundToNearest(anchor.anchorBaseKg, incr) ===
    roundToNearest(anchor.formulaWeightKg, incr)
  ) {
    return false;
  }
  return true;
}
