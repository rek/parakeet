// @spec docs/features/session/spec-today.md
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { upsertModifierCalibration } from '../data/calibration.repository';

const PENDING_PROMPT_KEY = 'pending_calibration_prompt';

export type CalibrationModifierSource =
  | 'readiness'
  | 'cycle_phase'
  | 'soreness';

interface AcceptParams {
  userId: string;
  modifierSource: CalibrationModifierSource;
  proposed: number;
  sampleCount: number;
  meanBias: number;
}

interface RevertParams {
  userId: string;
  modifierSource: CalibrationModifierSource;
  currentDefault: number;
  sampleCount: number;
  meanBias: number;
}

/**
 * Calibration prompt actions for the Today screen's "Training Adjustment" card.
 *
 * - Accept: keep the (already-applied) proposed value, bump confidence → 'high'.
 *   Signals to the engine that the user agrees with the calibration.
 * - Revert: re-write the previous default, drop confidence → 'medium'.
 *
 * Both actions clear the AsyncStorage prompt key and invalidate calibration
 * queries so any downstream UI reflects the new state.
 */
export function useCalibrationActions() {
  const queryClient = useQueryClient();

  const accept = useMutation({
    mutationFn: async (params: AcceptParams) => {
      await upsertModifierCalibration({
        userId: params.userId,
        modifierSource: params.modifierSource,
        adjustment: params.proposed,
        confidence: 'high',
        sampleCount: params.sampleCount,
        meanBias: params.meanBias,
      });
      await AsyncStorage.removeItem(PENDING_PROMPT_KEY);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration'] });
    },
  });

  const revert = useMutation({
    mutationFn: async (params: RevertParams) => {
      await upsertModifierCalibration({
        userId: params.userId,
        modifierSource: params.modifierSource,
        adjustment: params.currentDefault,
        confidence: 'medium',
        sampleCount: params.sampleCount,
        meanBias: params.meanBias,
      });
      await AsyncStorage.removeItem(PENDING_PROMPT_KEY);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration'] });
    },
  });

  return {
    acceptCalibration: accept.mutateAsync,
    revertCalibration: revert.mutateAsync,
    isAccepting: accept.isPending,
    isReverting: revert.isPending,
  };
}
