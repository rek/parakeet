// @spec docs/features/rehab-mode/spec-engine.md
//
// Single source of truth for the Rehab Mode cap clamp (GH#220). Used by:
//
// - `buildFinalMainSets` (formula path)
// - `enforceHardConstraints` (LLM + hybrid paths)
//
// Without sharing one helper, the cap is silently bypassed by any JIT path
// that doesn't apply it — exactly the cross-strategy-gap pattern documented
// in `docs/guide/ai-learnings.md`.

import { roundUpToNearest } from '../formulas/weight-rounding';
import type { JITInput } from './jit-session-generator';

/** Returns the rehab cap rounded UP to the lifter's plate increment, or `null`
 *  when no cap is active for this session's primary lift. Rounding up (per
 *  GH#220 decision) means a 82.5kg cap on 5kg plates prescribes 85kg — the
 *  lifter chose the cap value knowing their plate set. */
export function resolveRehabCeilingKg(
  input: JITInput,
  increment: number
): number | null {
  if (!input.activeRehabCap) return null;
  if (input.activeRehabCap.lift !== input.primaryLift) return null;
  return roundUpToNearest(input.activeRehabCap.capKg, increment);
}

/** Clamp a prescribed weight to the rehab cap ceiling. Returns the unchanged
 *  weight and `cappedByRehab: false` when no cap is active or the formula
 *  weight is already at or below the ceiling. */
export function applyRehabClamp(
  weightKg: number,
  input: JITInput,
  increment: number
): { finalWeightKg: number; cappedByRehab: boolean; rehabCapKg: number | null } {
  const ceiling = resolveRehabCeilingKg(input, increment);
  if (ceiling === null || weightKg <= ceiling) {
    return { finalWeightKg: weightKg, cappedByRehab: false, rehabCapKg: null };
  }
  return { finalWeightKg: ceiling, cappedByRehab: true, rehabCapKg: ceiling };
}
