import { PlannedSet } from '@parakeet/shared-types';

import { roundToNearest } from '../formulas/weight-rounding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VolumeReductionSource = 'soreness' | 'readiness' | 'cycle_phase' | 'disruption';

export interface VolumeReductions {
  totalSetsRemoved: number;
  baseSetsCount: number;
  sources: Array<{ source: VolumeReductionSource; setsRemoved: number }>;
  recoveryBlocked: boolean;
}

export interface VolumeRecoveryContext {
  completedSets: Array<{
    rpe_actual?: number;
    rpe_target?: number;
  }>;
  volumeReductions: VolumeReductions;
  /** Weight for recovered sets (matches current working weight) */
  currentWeightKg: number;
  /** Reps for recovered sets */
  currentReps: number;
  /** RPE target for the session's working sets */
  rpeTarget: number;
}

export interface VolumeRecoveryOffer {
  /** Number of sets available to add back */
  setsAvailable: number;
  /** Pre-built sets matching current working parameters */
  recoveredSets: PlannedSet[];
  /** Human-readable rationale */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Evaluates whether the lifter has more capacity than the JIT-reduced plan
 * anticipated. Returns an offer to add sets back when actual RPE is
 * consistently below target, or null if recovery is not warranted.
 *
 * Requires at least 1 completed set with RPE data. The average RPE gap
 * (target - actual) must be >= 1.5 to trigger an offer.
 */
export function evaluateVolumeRecovery(
  ctx: VolumeRecoveryContext
): VolumeRecoveryOffer | null {
  const { completedSets, volumeReductions, currentWeightKg, currentReps, rpeTarget } = ctx;

  // Recovery mode (soreness 5) — session is fundamentally different, no recovery
  if (volumeReductions.recoveryBlocked) return null;

  // Nothing to recover
  if (volumeReductions.totalSetsRemoved <= 0) return null;

  // Need at least 1 completed set with RPE
  const setsWithRpe = completedSets.filter(
    (s): s is { rpe_actual: number; rpe_target: number } =>
      s.rpe_actual != null && s.rpe_target != null
  );
  if (setsWithRpe.length < 1) return null;

  // Compute average RPE gap (positive = easier than expected)
  const avgGap =
    setsWithRpe.reduce((sum, s) => sum + (s.rpe_target - s.rpe_actual), 0) /
    setsWithRpe.length;

  if (avgGap < 1.5) return null;

  const setsAvailable = volumeReductions.totalSetsRemoved;
  const recoveredSets: PlannedSet[] = Array.from(
    { length: setsAvailable },
    (_, i) => ({
      set_number: i + 1, // will be renumbered by the store
      weight_kg: roundToNearest(currentWeightKg),
      reps: currentReps,
      rpe_target: rpeTarget,
    })
  );

  const sourceLabels = volumeReductions.sources
    .map((s) => s.source.replace('_', ' '))
    .join(', ');

  return {
    setsAvailable,
    recoveredSets,
    rationale: `RPE ${avgGap.toFixed(1)} below target — ${setsAvailable} set${setsAvailable > 1 ? 's' : ''} removed for ${sourceLabels} can be added back`,
  };
}
