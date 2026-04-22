// @spec docs/features/session/spec-performance.md
import { evaluateVolumeRecovery } from '@parakeet/training-engine';
import { useSessionStore } from '../store/sessionStore';
import { DEFAULT_RPE_TARGET } from '@shared/constants/training';

import type { JitData } from '../model/types';

/**
 * Reads the current session state and cached JIT data to determine whether
 * volume recovery should be offered. Called after each main lift RPE is recorded.
 *
 * Side effect: calls setRecoveryOffer on the session store when an offer is warranted.
 */
export function checkVolumeRecovery(): void {
  const state = useSessionStore.getState();

  // Already offered or dismissed this session
  if (state.recoveryOffer !== null || state.recoveryDismissed) return;

  // Parse cached JIT data for volumeReductions and rpe_target
  if (!state.cachedJitData) return;
  let jitData: JitData;
  try {
    jitData = JSON.parse(state.cachedJitData) as JitData;
  } catch {
    return;
  }

  if (!jitData.volumeReductions) return;

  // rpe_target lives on the JIT mainLiftSets, not the store's plannedSets
  const jitSets = jitData.mainLiftSets;
  const defaultRpeTarget = jitSets[0]?.rpe_target ?? DEFAULT_RPE_TARGET;

  // Build completed sets with RPE context from the store
  const completedSets = state.actualSets
    .filter((s) => s.is_completed && s.rpe_actual != null)
    .map((s) => ({
      rpe_actual: s.rpe_actual,
      rpe_target: jitSets[s.set_number - 1]?.rpe_target ?? defaultRpeTarget,
    }));

  // Current working weight/reps from first planned set
  const firstPlanned = state.plannedSets[0];
  if (!firstPlanned) return;

  const offer = evaluateVolumeRecovery({
    completedSets,
    volumeReductions: jitData.volumeReductions,
    currentWeightKg: firstPlanned.weight_kg,
    currentReps: firstPlanned.reps,
    rpeTarget: defaultRpeTarget,
  });

  if (offer) {
    state.setRecoveryOffer(offer);
  }
}
