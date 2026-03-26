import { evaluateWeightAutoregulation } from '@parakeet/training-engine';
import { Lift } from '@parakeet/shared-types';
import { useSessionStore } from '@platform/store/sessionStore';
import { weightGramsToKg } from '@shared/utils/weight';

import type { JitData } from '../model/types';

/**
 * Reads the current session state and checks whether a weight increase
 * should be suggested for the next set. Called after each main lift RPE
 * is recorded, parallel to checkVolumeRecovery().
 *
 * Side effect: calls setWeightSuggestion on the session store when warranted.
 */
export function checkWeightAutoregulation(): void {
  const state = useSessionStore.getState();

  // Already have an active suggestion or already adjusted this session
  if (state.weightSuggestion !== null) return;
  if (state.hasAcceptedWeightSuggestion) return;

  // Parse cached JIT data for rpe_target and session context
  if (!state.cachedJitData) return;
  let jitData: JitData;
  try {
    jitData = JSON.parse(state.cachedJitData) as JitData;
  } catch {
    return;
  }

  // Find the most recently completed set with RPE
  const completedWithRpe = state.actualSets
    .filter((s) => s.is_completed && s.rpe_actual != null)
    .sort((a, b) => b.set_number - a.set_number);

  if (completedWithRpe.length === 0) return;
  const lastSet = completedWithRpe[0];

  // RPE target from JIT data
  const jitSets = jitData.mainLiftSets;
  const rpeTarget = jitSets[lastSet.set_number - 1]?.rpe_target ?? jitSets[0]?.rpe_target ?? 8.5;

  // Count remaining incomplete main sets
  const remainingSetCount = state.actualSets.filter((s) => !s.is_completed).length;

  // Session context
  const primaryLift = (state.sessionMeta?.primary_lift ?? 'bench') as Lift;
  const intensityType = state.sessionMeta?.intensity_type;
  const isDeload = intensityType === 'deload';

  // Recovery mode: volumeReductions.recoveryBlocked means soreness >= 9/10
  const isRecoveryMode = jitData.volumeReductions?.recoveryBlocked === true;

  const suggestion = evaluateWeightAutoregulation({
    rpeActual: lastSet.rpe_actual!,
    rpeTarget,
    currentWeightKg: weightGramsToKg(lastSet.weight_grams),
    primaryLift,
    remainingSetCount,
    isDeload,
    isRecoveryMode,
    hasAlreadyAdjusted: state.hasAcceptedWeightSuggestion,
  });

  if (suggestion) {
    state.setWeightSuggestion(suggestion);
  }
}
