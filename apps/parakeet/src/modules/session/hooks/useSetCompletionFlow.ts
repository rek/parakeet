import { useCallback, useRef } from 'react';

import type { RestTimerPrefs } from '@modules/settings';
import type { Lift } from '@parakeet/shared-types';
import { adaptRemainingPlan } from '@parakeet/training-engine';
import { useSessionStore } from '@platform/store/sessionStore';
import { getExerciseType } from '@shared/utils/exercise-lookup';
import { weightGramsToKg, weightKgToGrams } from '@shared/utils/weight';

import type { RestRecommendations } from '../model/types';
import {
  DEFAULT_AUX_REST_SECONDS,
  DEFAULT_MAIN_REST_SECONDS,
} from '../model/types';
import { computeDismissResult } from '../utils/computeDismissResult';
import { getEffectivePlannedSet } from '@shared/utils/getEffectivePlannedSet';
import { writeAuxFailureAndAdapt } from '../utils/set-outcome-helpers';
import {
  resolveNextAuxSetWeight,
  resolveWeightForNextSet,
} from '../utils/set-weight-resolver';
import { checkVolumeRecovery } from '../utils/volume-recovery-check';
import { checkWeightAutoregulation } from '../utils/weight-autoregulation-check';

export function useSetCompletionFlow({
  restTimerPrefsRef,
  restRecommendations,
  plannedSetsLengthRef,
  oneRmKgRef,
  biologicalSexRef,
}: {
  restTimerPrefsRef: React.RefObject<RestTimerPrefs>;
  restRecommendations: React.RefObject<RestRecommendations | null>;
  plannedSetsLengthRef: React.RefObject<number>;
  oneRmKgRef: React.RefObject<number | undefined>;
  biologicalSexRef: React.RefObject<'male' | 'female' | undefined>;
}) {
  const {
    plannedSets,
    auxiliaryWork,
    pendingRpeSetNumber,
    pendingAuxRpe,
    pendingAuxConfirmation,
    updateSet,
    updateAuxiliarySet,
    openTimer,
    closeTimer,
    sessionMeta,
    recordSetFailure,
    recordSetSuccess,
    setAdaptation,
    showMainPostRest,
    showAuxPostRest,
    showWarmupPostRest,
    clearPostRestState,
    extendPostRest,
    tickPostRestCountdown,
    setPendingRpe,
    setPendingAuxRpe,
    clearPendingRpe,
    setPendingAuxConfirmation,
    clearPendingAuxConfirmation,
  } = useSessionStore();

  const resetIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function cleanupResetInterval() {
    if (resetIntervalRef.current !== null) {
      clearInterval(resetIntervalRef.current);
      resetIntervalRef.current = null;
    }
  }

  function clearPostRestStateFn() {
    cleanupResetInterval();
    clearPostRestState();
  }

  function dismissPostRest() {
    cleanupResetInterval();
    const current = useSessionStore.getState().postRestQueue[0] ?? null;
    const result = computeDismissResult(current, Date.now());
    clearPostRestState();
    return result;
  }

  const handleSetUpdate = useCallback(
    (
      setNumber: number,
      data: {
        weightKg: number;
        reps: number;
        rpe?: number;
        isCompleted: boolean;
      }
    ) => {
      const wasCompleted =
        useSessionStore
          .getState()
          .actualSets.find((s) => s.set_number === setNumber)?.is_completed ??
        false;

      updateSet(setNumber, {
        weight_grams: weightKgToGrams(data.weightKg),
        reps_completed: data.reps,
        rpe_actual: data.rpe,
        is_completed: data.isCompleted,
      });

      if (data.isCompleted) {
        if (!wasCompleted) {
          setPendingRpe(setNumber);

          // No rest timer after the last set
          if (setNumber >= plannedSetsLengthRef.current) return;

          if (!restTimerPrefsRef.current.mainSetsEnabled) return;

          const duration =
            restRecommendations.current?.mainLift[setNumber - 1] ??
            DEFAULT_MAIN_REST_SECONDS;

          openTimer({
            durationSeconds: duration,
            pendingMainSetNumber: setNumber,
          });
        }
      } else {
        if (pendingRpeSetNumber === setNumber) {
          clearPendingRpe();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateSet, openTimer, pendingRpeSetNumber, clearPendingRpe]
  );

  const handleAuxSetUpdate = useCallback(
    (
      exerciseIndex: number,
      exercise: string,
      setNumber: number,
      setsInExercise: number,
      data: {
        weightKg: number;
        reps: number;
        rpe?: number;
        isCompleted: boolean;
      }
    ) => {
      const storeState = useSessionStore.getState();
      const wasAuxCompleted =
        storeState.auxiliarySets.find(
          (s) => s.exercise === exercise && s.set_number === setNumber
        )?.is_completed ?? false;

      // First non-timed aux set: show confirmation overlay instead of auto-completing
      // Fall back to catalog lookup so ad-hoc timed exercises are detected correctly
      const exerciseType =
        auxiliaryWork.find((aw) => aw.exercise === exercise)?.exerciseType ??
        getExerciseType(exercise);
      const isTimed = exerciseType === 'timed';
      const isBodyweight = exerciseType === 'bodyweight';
      const isFirstCompletion = data.isCompleted && !wasAuxCompleted;
      const noPriorRestForThisSet = !storeState.auxiliarySets.some(
        (s) => s.exercise === exercise && s.is_completed
      );

      if (isFirstCompletion && !isTimed && noPriorRestForThisSet) {
        // Don't write to store yet — show confirmation overlay
        setPendingAuxConfirmation({
          exerciseIndex,
          exercise,
          setNumber,
          setsInExercise,
          weightGrams: weightKgToGrams(data.weightKg),
          reps: data.reps,
        });
        return;
      }

      updateAuxiliarySet(exercise, setNumber, {
        weight_grams: weightKgToGrams(data.weightKg),
        reps_completed: data.reps,
        rpe_actual: data.rpe,
        is_completed: data.isCompleted,
      });

      if (data.isCompleted) {
        if (!wasAuxCompleted) {
          if (!isTimed && !isBodyweight)
            setPendingAuxRpe(exercise, setNumber);

          // No rest timer after the last set of this exercise
          if (setNumber >= setsInExercise) return;

          if (isTimed || isBodyweight) return;

          if (!restTimerPrefsRef.current.auxSetsEnabled) return;

          const duration =
            restRecommendations.current?.auxiliary[exerciseIndex] ??
            DEFAULT_AUX_REST_SECONDS;

          openTimer({
            durationSeconds: duration,
            pendingAuxExercise: exercise,
            pendingAuxSetNumber: setNumber,
          });
        }
      } else {
        if (pendingAuxRpe?.exercise === exercise && pendingAuxRpe?.setNumber === setNumber) {
          clearPendingRpe();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateAuxiliarySet, openTimer, pendingAuxRpe, clearPendingRpe]
  );

  // --- Timer done: dispatch to main/aux/warmup handler (logic moved to store actions) ---

  function handleTimerDone() {
    const state = useSessionStore.getState();
    const activeKey = state.activeTimerKey;
    const activeTimer = activeKey ? state.timers[activeKey] : null;
    if (!activeTimer) return;

    const pendingMain = activeTimer.pendingMainSetNumber;
    const pendingAuxExercise = activeTimer.pendingAuxExercise;
    const pendingAuxSet = activeTimer.pendingAuxSetNumber;

    const elapsedSeconds = closeTimer();

    clearPendingRpe();

    if (pendingMain !== null) {
      updateSet(pendingMain, { actual_rest_seconds: elapsedSeconds });
      showMainPostRest(pendingMain, elapsedSeconds);
    } else if (pendingAuxExercise !== null && pendingAuxSet !== null) {
      updateAuxiliarySet(pendingAuxExercise, pendingAuxSet, {
        actual_rest_seconds: elapsedSeconds,
      });
      showAuxPostRest(pendingAuxExercise, pendingAuxSet, elapsedSeconds);
    } else if (plannedSets.length > 0) {
      showWarmupPostRest(elapsedSeconds);
    }
  }

  // --- Lift complete: dispatch to main/aux handler ---

  function handleAuxLiftComplete(
    auxExercise: string,
    auxSetNumber: number,
    totalRest: number
  ) {
    updateAuxiliarySet(auxExercise, auxSetNumber, {
      actual_rest_seconds: totalRest,
    });

    const nextAuxSet = auxSetNumber + 1;
    const auxWork = auxiliaryWork.find((aw) => aw.exercise === auxExercise);
    const totalAuxSets = auxWork?.sets.length ?? 0;

    if (nextAuxSet <= totalAuxSets) {
      const planned = auxWork!.sets[nextAuxSet - 1];
      const auxWeightGrams = resolveNextAuxSetWeight({
        auxiliarySets: useSessionStore.getState().auxiliarySets,
        exercise: auxExercise,
        nextSetNumber: nextAuxSet,
        plannedWeightKg: planned.weight_kg,
      });
      updateAuxiliarySet(auxExercise, nextAuxSet, {
        weight_grams: auxWeightGrams,
        reps_completed: planned.reps,
        is_completed: true,
      });
      const auxType = auxWork?.exerciseType ?? getExerciseType(auxExercise);
      if (auxType !== 'timed' && auxType !== 'bodyweight')
        setPendingAuxRpe(auxExercise, nextAuxSet);

      if (
        nextAuxSet < totalAuxSets &&
        auxType !== 'timed' &&
        auxType !== 'bodyweight' &&
        restTimerPrefsRef.current.auxSetsEnabled
      ) {
        const exerciseIndex = auxiliaryWork.findIndex(
          (aw) => aw.exercise === auxExercise
        );
        const duration =
          restRecommendations.current?.auxiliary[exerciseIndex] ??
          DEFAULT_AUX_REST_SECONDS;
        openTimer({
          durationSeconds: duration,
          pendingAuxExercise: auxExercise,
          pendingAuxSetNumber: nextAuxSet,
        });
      }
    }
  }

  function handleMainLiftComplete(
    prevSetNumber: number | null,
    nextSetNumber: number | null,
    totalRest: number
  ) {
    recordSetSuccess();

    if (prevSetNumber !== null) {
      updateSet(prevSetNumber, { actual_rest_seconds: totalRest });
    }

    if (nextSetNumber !== null && nextSetNumber <= plannedSets.length) {
      const storeState = useSessionStore.getState();
      const effective = getEffectivePlannedSet(
        nextSetNumber - 1,
        plannedSets,
        storeState.actualSets,
        storeState.currentAdaptation
      );
      const weightGrams = resolveWeightForNextSet({
        actualSets: storeState.actualSets,
        plannedSets,
        nextSetNumber,
        effectiveWeightKg: effective?.weight_kg ?? 0,
      });
      updateSet(nextSetNumber, {
        weight_grams: weightGrams,
        reps_completed: effective?.reps ?? 0,
        is_completed: true,
      });
      setPendingRpe(nextSetNumber);

      if (
        nextSetNumber < plannedSetsLengthRef.current &&
        restTimerPrefsRef.current.mainSetsEnabled
      ) {
        const duration =
          restRecommendations.current?.mainLift[nextSetNumber - 1] ??
          DEFAULT_MAIN_REST_SECONDS;
        openTimer({
          durationSeconds: duration,
          pendingMainSetNumber: nextSetNumber,
        });
      }
    }
  }

  function handleLiftComplete() {
    const {
      totalRest,
      prevSetNumber,
      nextSetNumber,
      auxExercise,
      auxSetNumber,
    } = dismissPostRest();

    if (auxExercise !== null && auxSetNumber !== null) {
      handleAuxLiftComplete(auxExercise, auxSetNumber, totalRest);
    } else {
      handleMainLiftComplete(prevSetNumber, nextSetNumber, totalRest);
    }
  }

  // --- Lift failed: dispatch to main/aux handler ---

  function handleAuxLiftFailed(
    auxExercise: string,
    auxSetNumber: number,
    totalRest: number,
    actualReps: number
  ) {
    updateAuxiliarySet(auxExercise, auxSetNumber, {
      actual_rest_seconds: totalRest,
    });

    const failedSetNumber = auxSetNumber + 1;
    const auxWork = auxiliaryWork.find((aw) => aw.exercise === auxExercise);
    const totalAuxSets = auxWork?.sets.length ?? 0;

    if (failedSetNumber <= totalAuxSets) {
      const auxWeightGrams = resolveNextAuxSetWeight({
        auxiliarySets: useSessionStore.getState().auxiliarySets,
        exercise: auxExercise,
        nextSetNumber: failedSetNumber,
        plannedWeightKg: auxWork!.sets[failedSetNumber - 1]?.weight_kg ?? 0,
      });
      writeAuxFailureAndAdapt(
        auxExercise,
        failedSetNumber,
        auxWeightGrams,
        actualReps,
        auxiliaryWork
      );
    }
  }

  function handleMainLiftFailed(
    prevSetNumber: number | null,
    nextSetNumber: number | null,
    totalRest: number,
    actualReps: number
  ) {
    if (prevSetNumber !== null) {
      updateSet(prevSetNumber, { actual_rest_seconds: totalRest });
    }
    if (nextSetNumber !== null && nextSetNumber <= plannedSets.length) {
      const storeState = useSessionStore.getState();
      const effective = getEffectivePlannedSet(
        nextSetNumber - 1,
        storeState.plannedSets,
        storeState.actualSets,
        storeState.currentAdaptation
      );
      const failedWeightGrams = resolveWeightForNextSet({
        actualSets: storeState.actualSets,
        plannedSets: storeState.plannedSets,
        nextSetNumber,
        effectiveWeightKg: effective?.weight_kg ?? 0,
      });
      updateSet(nextSetNumber, {
        weight_grams: failedWeightGrams,
        reps_completed: actualReps,
        is_completed: true,
        rpe_actual: 10, // failed set = max effort by definition
        failed: true,
      });
    }

    recordSetFailure();

    const newFailureCount =
      useSessionStore.getState().consecutiveMainLiftFailures;
    const primaryLift = sessionMeta?.primary_lift as Lift | null | undefined;
    const resolvedOneRmKg = oneRmKgRef.current;

    if (primaryLift && resolvedOneRmKg != null) {
      const state = useSessionStore.getState();
      const completedSets = state.actualSets
        .filter((s) => s.is_completed)
        .map((s) => ({
          planned_reps:
            state.plannedSets[s.set_number - 1]?.reps ?? s.reps_completed,
          actual_reps: s.reps_completed,
          weight_kg: weightGramsToKg(s.weight_grams),
        }));
      const startIdx = prevSetNumber ?? 0;
      const remainingSets = state.plannedSets
        .slice(startIdx)
        .reduce<
          { set_number: number; weight_kg: number; reps: number }[]
        >((acc, s, idx) => {
          const setNumber = startIdx + idx + 1;
          const isCompleted = state.actualSets.some(
            (a) => a.set_number === setNumber && a.is_completed
          );
          if (!isCompleted) {
            acc.push({
              set_number: setNumber,
              weight_kg: s.weight_kg,
              reps: s.reps,
            });
          }
          return acc;
        }, []);

      const adapted = adaptRemainingPlan({
        completedSets,
        remainingSets,
        consecutiveFailures: newFailureCount,
        primaryLift,
        oneRmKg: resolvedOneRmKg,
        biologicalSex: biologicalSexRef.current,
      });

      if (adapted.adaptationType !== 'none') {
        setAdaptation(adapted);
      }
    }
  }

  function handleLiftFailed(actualReps: number) {
    const {
      totalRest,
      prevSetNumber,
      nextSetNumber,
      auxExercise,
      auxSetNumber,
    } = dismissPostRest();

    if (auxExercise !== null && auxSetNumber !== null) {
      handleAuxLiftFailed(auxExercise, auxSetNumber, totalRest, actualReps);
    } else {
      handleMainLiftFailed(prevSetNumber, nextSetNumber, totalRest, actualReps);
    }
  }

  function handlePostRestReset() {
    const current = useSessionStore.getState().postRestQueue[0];
    if (!current) return;
    cleanupResetInterval();

    const newRest = current.actualRestSeconds + 15;
    if (current.pendingMainSetNumber !== null) {
      updateSet(current.pendingMainSetNumber, {
        actual_rest_seconds: newRest,
      });
    } else if (
      current.pendingAuxExercise !== null &&
      current.pendingAuxSetNumber !== null
    ) {
      updateAuxiliarySet(
        current.pendingAuxExercise,
        current.pendingAuxSetNumber,
        { actual_rest_seconds: newRest }
      );
    }
    extendPostRest();
    resetIntervalRef.current = setInterval(() => {
      tickPostRestCountdown();
    }, 1000);
  }

  function handleRpeQuickSelect(rpe: number) {
    if (pendingRpeSetNumber !== null) {
      updateSet(pendingRpeSetNumber, { rpe_actual: rpe });
      clearPendingRpe();
      // Check for volume recovery and weight autoregulation after main lift RPE
      checkVolumeRecovery();
      checkWeightAutoregulation();
    } else if (pendingAuxRpe !== null) {
      updateAuxiliarySet(pendingAuxRpe.exercise, pendingAuxRpe.setNumber, {
        rpe_actual: rpe,
      });
      clearPendingRpe();
    }
  }

  function handleRpeQuickSkip() {
    clearPendingRpe();
  }

  function requestMainRpe(setNumber: number) {
    setPendingRpe(setNumber);
  }

  function requestAuxRpe(exercise: string, setNumber: number) {
    setPendingAuxRpe(exercise, setNumber);
  }

  // --- First aux set confirmation handlers ---

  function handleAuxConfirmComplete() {
    const conf = pendingAuxConfirmation;
    if (!conf) return;
    clearPendingAuxConfirmation();

    // Write the completion to the store
    updateAuxiliarySet(conf.exercise, conf.setNumber, {
      weight_grams: conf.weightGrams,
      reps_completed: conf.reps,
      is_completed: true,
    });

    const confType =
      auxiliaryWork.find((aw) => aw.exercise === conf.exercise)?.exerciseType ??
      getExerciseType(conf.exercise);
    if (confType !== 'timed' && confType !== 'bodyweight')
      setPendingAuxRpe(conf.exercise, conf.setNumber);

    // Open rest timer if not last set and aux timer enabled
    if (conf.setNumber >= conf.setsInExercise) return;
    if (confType === 'timed' || confType === 'bodyweight') return;
    if (!restTimerPrefsRef.current.auxSetsEnabled) return;

    const duration =
      restRecommendations.current?.auxiliary[conf.exerciseIndex] ??
      DEFAULT_AUX_REST_SECONDS;

    openTimer({
      durationSeconds: duration,
      pendingAuxExercise: conf.exercise,
      pendingAuxSetNumber: conf.setNumber,
    });
  }

  function handleAuxConfirmFailed(actualReps: number) {
    const conf = pendingAuxConfirmation;
    if (!conf) return;
    clearPendingAuxConfirmation();

    const failedType =
      auxiliaryWork.find((aw) => aw.exercise === conf.exercise)?.exerciseType ??
      getExerciseType(conf.exercise);

    // Write failure + adapt remaining sets via shared helper
    writeAuxFailureAndAdapt(
      conf.exercise,
      conf.setNumber,
      conf.weightGrams,
      actualReps,
      auxiliaryWork
    );

    // Open rest timer if not last set and aux timer enabled
    if (conf.setNumber >= conf.setsInExercise) return;
    if (failedType === 'timed' || failedType === 'bodyweight') return;
    if (!restTimerPrefsRef.current.auxSetsEnabled) return;

    const duration =
      restRecommendations.current?.auxiliary[conf.exerciseIndex] ??
      DEFAULT_AUX_REST_SECONDS;

    openTimer({
      durationSeconds: duration,
      pendingAuxExercise: conf.exercise,
      pendingAuxSetNumber: conf.setNumber,
    });
  }

  return {
    handleSetUpdate,
    handleAuxSetUpdate,
    handleTimerDone,
    handleLiftComplete,
    handleLiftFailed,
    handlePostRestReset,
    handleRpeQuickSelect,
    handleRpeQuickSkip,
    handleAuxConfirmComplete,
    handleAuxConfirmFailed,
    requestMainRpe,
    requestAuxRpe,
    cleanupResetInterval,
    clearPostRestState: clearPostRestStateFn,
  };
}
