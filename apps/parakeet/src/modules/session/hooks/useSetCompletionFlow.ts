import { useCallback, useRef, useState } from 'react';

import type { RestTimerPrefs } from '@modules/settings';
import type { Lift } from '@parakeet/shared-types';
import { adaptRemainingPlan } from '@parakeet/training-engine';
import { weightGramsToKg, weightKgToGrams } from '@shared/utils/weight';
import { useSessionStore } from '@platform/store/sessionStore';

import type {
  AuxiliaryWork,
  PostRestState,
  RestRecommendations,
} from '../model/types';
import {
  DEFAULT_AUX_REST_SECONDS,
  DEFAULT_MAIN_REST_SECONDS,
} from '../model/types';
import { computeDismissResult } from '../utils/computeDismissResult';
import {
  resolveNextAuxSetWeight,
  resolveNextSetWeight,
} from '../utils/set-weight-resolver';
import { checkVolumeRecovery } from '../utils/volume-recovery-check';

export function useSetCompletionFlow({
  restTimerPrefsRef,
  restRecommendations,
  auxiliaryWork,
  plannedSetsLengthRef,
  oneRmKgRef,
  biologicalSexRef,
}: {
  restTimerPrefsRef: React.RefObject<RestTimerPrefs>;
  restRecommendations: React.RefObject<RestRecommendations | null>;
  auxiliaryWork: AuxiliaryWork[];
  plannedSetsLengthRef: React.RefObject<number>;
  oneRmKgRef: React.RefObject<number | undefined>;
  biologicalSexRef: React.RefObject<'male' | 'female' | undefined>;
}) {
  const {
    timerState,
    plannedSets,
    updateSet,
    updateAuxiliarySet,
    openTimer,
    closeTimer,
    sessionMeta,
    recordSetFailure,
    recordSetSuccess,
    setAdaptation,
  } = useSessionStore();

  const [postRestState, setPostRestState] = useState<PostRestState | null>(
    null
  );
  const resetIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingRpeSetNumber, setPendingRpeSetNumber] = useState<number | null>(
    null
  );
  const [pendingAuxRpe, setPendingAuxRpe] = useState<{
    exercise: string;
    setNumber: number;
  } | null>(null);

  function cleanupResetInterval() {
    if (resetIntervalRef.current !== null) {
      clearInterval(resetIntervalRef.current);
      resetIntervalRef.current = null;
    }
  }

  function clearPostRestState() {
    cleanupResetInterval();
    setPostRestState(null);
  }

  function dismissPostRest() {
    cleanupResetInterval();
    const result = computeDismissResult(postRestState, Date.now());
    setPostRestState(null);
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
          setPendingRpeSetNumber(setNumber);

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
        setPendingRpeSetNumber((prev) => (prev === setNumber ? null : prev));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateSet, openTimer]
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
      const wasAuxCompleted =
        useSessionStore
          .getState()
          .auxiliarySets.find(
            (s) => s.exercise === exercise && s.set_number === setNumber
          )?.is_completed ?? false;

      updateAuxiliarySet(exercise, setNumber, {
        weight_grams: weightKgToGrams(data.weightKg),
        reps_completed: data.reps,
        rpe_actual: data.rpe,
        is_completed: data.isCompleted,
      });

      if (data.isCompleted) {
        if (!wasAuxCompleted) {
          const exerciseType = auxiliaryWork.find(
            (aw) => aw.exercise === exercise
          )?.exerciseType;
          const isTimed = exerciseType === 'timed';

          if (!isTimed) setPendingAuxRpe({ exercise, setNumber });

          // No rest timer after the last set of this exercise
          if (setNumber >= setsInExercise) return;

          if (isTimed) return;

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
        setPendingAuxRpe((prev) =>
          prev?.exercise === exercise && prev?.setNumber === setNumber
            ? null
            : prev
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateAuxiliarySet, openTimer]
  );

  // --- Timer done: dispatch to main/aux/warmup handler ---

  function showMainPostRest(pendingMain: number, elapsedSeconds: number) {
    const nextSet = plannedSets[pendingMain];
    setPostRestState({
      pendingMainSetNumber: pendingMain,
      pendingAuxExercise: null,
      pendingAuxSetNumber: null,
      actualRestSeconds: elapsedSeconds,
      liftStartedAt: Date.now(),
      plannedReps: nextSet?.reps ?? 0,
      plannedWeightKg: nextSet?.weight_kg ?? null,
      nextSetNumber: pendingMain + 1,
      resetSecondsRemaining: null,
    });
  }

  function showAuxPostRest(pendingAuxExercise: string, pendingAuxSet: number, elapsedSeconds: number) {
    const auxWork = auxiliaryWork.find(
      (aw) => aw.exercise === pendingAuxExercise
    );
    const nextAuxSet = auxWork?.sets[pendingAuxSet];
    setPostRestState({
      pendingMainSetNumber: null,
      pendingAuxExercise,
      pendingAuxSetNumber: pendingAuxSet,
      actualRestSeconds: elapsedSeconds,
      liftStartedAt: Date.now(),
      plannedReps: nextAuxSet?.reps ?? 0,
      plannedWeightKg: nextAuxSet?.weight_kg ?? null,
      nextSetNumber: pendingAuxSet + 1,
      resetSecondsRemaining: null,
    });
  }

  function showWarmupPostRest(elapsedSeconds: number) {
    const firstSet = plannedSets[0];
    setPostRestState({
      pendingMainSetNumber: null,
      pendingAuxExercise: null,
      pendingAuxSetNumber: null,
      actualRestSeconds: elapsedSeconds,
      liftStartedAt: Date.now(),
      plannedReps: firstSet.reps,
      plannedWeightKg: firstSet.weight_kg,
      nextSetNumber: 1,
      resetSecondsRemaining: null,
    });
  }

  function handleTimerDone() {
    const pendingMain = timerState?.pendingMainSetNumber ?? null;
    const pendingAuxExercise = timerState?.pendingAuxExercise ?? null;
    const pendingAuxSet = timerState?.pendingAuxSetNumber ?? null;

    const elapsedSeconds = closeTimer();

    setPendingRpeSetNumber(null);
    setPendingAuxRpe(null);

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

  function handleAuxLiftComplete(auxExercise: string, auxSetNumber: number, totalRest: number) {
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
      setPendingAuxRpe({ exercise: auxExercise, setNumber: nextAuxSet });

      if (
        nextAuxSet < totalAuxSets &&
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

  function handleMainLiftComplete(prevSetNumber: number | null, nextSetNumber: number | null, totalRest: number) {
    recordSetSuccess();

    if (prevSetNumber !== null) {
      updateSet(prevSetNumber, { actual_rest_seconds: totalRest });
    }

    if (nextSetNumber !== null && nextSetNumber <= plannedSets.length) {
      const planned = plannedSets[nextSetNumber - 1];
      const weightGrams = resolveNextSetWeight({
        completedSets: useSessionStore.getState().actualSets,
        nextSetNumber,
        plannedWeightKg: planned.weight_kg,
      });
      updateSet(nextSetNumber, {
        weight_grams: weightGrams,
        reps_completed: planned.reps,
        is_completed: true,
      });
      setPendingRpeSetNumber(nextSetNumber);

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
    const { totalRest, prevSetNumber, nextSetNumber, auxExercise, auxSetNumber } =
      dismissPostRest();

    if (auxExercise !== null && auxSetNumber !== null) {
      handleAuxLiftComplete(auxExercise, auxSetNumber, totalRest);
    } else {
      handleMainLiftComplete(prevSetNumber, nextSetNumber, totalRest);
    }
  }

  // --- Lift failed: dispatch to main/aux handler ---

  function handleAuxLiftFailed(auxExercise: string, auxSetNumber: number, totalRest: number, actualReps: number) {
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
      updateAuxiliarySet(auxExercise, failedSetNumber, {
        weight_grams: auxWeightGrams,
        reps_completed: actualReps,
        is_completed: true,
        rpe_actual: 10, // failed = max effort by definition
      });
    }
  }

  function handleMainLiftFailed(prevSetNumber: number | null, nextSetNumber: number | null, totalRest: number, actualReps: number) {
    if (prevSetNumber !== null) {
      updateSet(prevSetNumber, { actual_rest_seconds: totalRest });
    }
    if (nextSetNumber !== null && nextSetNumber <= plannedSets.length) {
      const failedWeightGrams = resolveNextSetWeight({
        completedSets: useSessionStore.getState().actualSets,
        nextSetNumber,
        plannedWeightKg: plannedSets[nextSetNumber - 1]?.weight_kg ?? 0,
      });
      updateSet(nextSetNumber, {
        weight_grams: failedWeightGrams,
        reps_completed: actualReps,
        is_completed: true,
        rpe_actual: 10, // failed set = max effort by definition
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
    const { totalRest, prevSetNumber, nextSetNumber, auxExercise, auxSetNumber } =
      dismissPostRest();

    if (auxExercise !== null && auxSetNumber !== null) {
      handleAuxLiftFailed(auxExercise, auxSetNumber, totalRest, actualReps);
    } else {
      handleMainLiftFailed(prevSetNumber, nextSetNumber, totalRest, actualReps);
    }
  }

  function handlePostRestReset() {
    if (!postRestState) return;
    cleanupResetInterval();

    const newRest = postRestState.actualRestSeconds + 15;
    if (postRestState.pendingMainSetNumber !== null) {
      updateSet(postRestState.pendingMainSetNumber, {
        actual_rest_seconds: newRest,
      });
    } else if (
      postRestState.pendingAuxExercise !== null &&
      postRestState.pendingAuxSetNumber !== null
    ) {
      updateAuxiliarySet(
        postRestState.pendingAuxExercise,
        postRestState.pendingAuxSetNumber,
        { actual_rest_seconds: newRest }
      );
    }
    setPostRestState((prev) =>
      prev
        ? { ...prev, actualRestSeconds: newRest, resetSecondsRemaining: 15 }
        : null
    );
    resetIntervalRef.current = setInterval(() => {
      setPostRestState((prev) => {
        if (!prev || prev.resetSecondsRemaining === null) return prev;
        const next = prev.resetSecondsRemaining - 1;
        if (next <= 0) {
          clearInterval(resetIntervalRef.current!);
          resetIntervalRef.current = null;
          return { ...prev, resetSecondsRemaining: null };
        }
        return { ...prev, resetSecondsRemaining: next };
      });
    }, 1000);
  }

  function handleRpeQuickSelect(rpe: number) {
    if (pendingRpeSetNumber !== null) {
      updateSet(pendingRpeSetNumber, { rpe_actual: rpe });
      setPendingRpeSetNumber(null);
      // Check for volume recovery eligibility after main lift RPE
      checkVolumeRecovery();
    } else if (pendingAuxRpe !== null) {
      updateAuxiliarySet(pendingAuxRpe.exercise, pendingAuxRpe.setNumber, {
        rpe_actual: rpe,
      });
      setPendingAuxRpe(null);
    }
  }

  function handleRpeQuickSkip() {
    setPendingRpeSetNumber(null);
    setPendingAuxRpe(null);
  }

  function requestMainRpe(setNumber: number) {
    setPendingRpeSetNumber(setNumber);
  }

  function requestAuxRpe(exercise: string, setNumber: number) {
    setPendingAuxRpe({ exercise, setNumber });
  }

  return {
    postRestState,
    pendingRpeSetNumber,
    pendingAuxRpe,
    handleSetUpdate,
    handleAuxSetUpdate,
    handleTimerDone,
    handleLiftComplete,
    handleLiftFailed,
    handlePostRestReset,
    handleRpeQuickSelect,
    handleRpeQuickSkip,
    requestMainRpe,
    requestAuxRpe,
    cleanupResetInterval,
    clearPostRestState,
  };
}
