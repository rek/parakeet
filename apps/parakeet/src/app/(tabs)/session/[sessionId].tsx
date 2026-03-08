import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { abandonSession, getSession, startSession } from '@modules/session';
import { getBarWeightKg } from '@modules/settings';
import { useNetworkStatus } from '@platform/network';
import { useSessionStore } from '@platform/store/sessionStore';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { AddExerciseModal } from '../../../components/session/AddExerciseModal';
import { LiftHistorySheet } from '../../../components/session/LiftHistorySheet';
import { RestTimer } from '../../../components/training/RestTimer';
import { RpeQuickPicker } from '../../../components/training/RpeQuickPicker';
import { SetRow } from '../../../components/training/SetRow';
import { WarmupSection } from '../../../components/training/WarmupSection';
import { colors } from '../../../theme';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlannedSet {
  weight_kg: number;
  reps: number;
  rpe_target?: number;
  set_type?: string;
}

interface WarmupSet {
  weightKg: number;
  reps: number;
  label?: string;
}

interface AuxiliaryWork {
  exercise: string;
  sets: PlannedSet[];
  skipped: boolean;
  skipReason?: string;
  exerciseType?: 'weighted' | 'bodyweight' | 'timed';
}

interface RestRecommendations {
  mainLift: number[];
  auxiliary: number[];
}

interface LlmRestSuggestion {
  deltaSeconds: number;
  formulaBaseSeconds: number;
}

interface JitData {
  mainLiftSets: PlannedSet[];
  warmupSets: WarmupSet[];
  auxiliaryWork: AuxiliaryWork[];
  restRecommendations?: RestRecommendations;
  llmRestSuggestion?: LlmRestSuggestion | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MAIN_REST_SECONDS = 180;
const DEFAULT_AUX_REST_SECONDS = 90;

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatExerciseName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SessionScreen() {
  const { sessionId, jitData, openHistory } = useLocalSearchParams<{
    sessionId: string;
    jitData: string;
    openHistory?: string;
  }>();

  const {
    actualSets,
    auxiliarySets,
    plannedSets,
    warmupCompleted,
    sessionMeta,
    timerState,
    initSession,
    initAuxiliary,
    updateSet,
    updateAuxiliarySet,
    addAdHocSet,
    setWarmupDone,
    setSessionMeta,
    setCachedJitData,
    openTimer,
    tickTimer,
    adjustTimer,
    closeTimer,
    reset,
  } = useSessionStore();

  const queryClient = useQueryClient();

  const [warmupSetsState, setWarmupSetsState] = useState<WarmupSet[]>([]);
  const [auxiliaryWork, setAuxiliaryWork] = useState<AuxiliaryWork[]>([]);
  const [barWeightKg, setBarWeightKg] = useState(20);

  useEffect(() => {
    getBarWeightKg().then(setBarWeightKg);
  }, []);
  const [adHocExercises, setAdHocExercises] = useState<string[]>([]);
  const [addExerciseVisible, setAddExerciseVisible] = useState(false);
  const [historySheetVisible, setHistorySheetVisible] = useState(false);
  const [pendingRpeSetNumber, setPendingRpeSetNumber] = useState<number | null>(null);
  const [pendingAuxRpe, setPendingAuxRpe] = useState<{ exercise: string; setNumber: number } | null>(null);
  const insets = useSafeAreaInsets();

  // Auto-open history sheet when banner navigates back with openHistory param
  useEffect(() => {
    if (openHistory === '1') setHistorySheetVisible(true);
  }, [openHistory]);

  // Mirror plannedSets.length in a ref so stable callbacks see the current value
  const plannedSetsLengthRef = useRef(0);
  useEffect(() => {
    plannedSetsLengthRef.current = plannedSets.length;
  }, [plannedSets.length]);

  // Rest recommendations extracted from jit output (re-populated on each mount)
  const restRecommendations = useRef<RestRecommendations | null>(null);
  const llmRestSuggestion = useRef<LlmRestSuggestion | null>(null);

  // Interval ref for focus-managed timer ticking
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId) {
      router.back();
      return;
    }

    // Read current store state directly — avoids stale closure from first render
    // (Zustand may not have finished hydrating from AsyncStorage at render time)
    const storeState = useSessionStore.getState();
    const currentStoreSessionId = storeState.sessionId;

    // If no jitData param, try recovering from the store's cached JIT (resume path
    // when navigating from program tab without cached JIT in route params)
    const effectiveJitData =
      jitData ??
      (currentStoreSessionId === sessionId ? storeState.cachedJitData : null);

    if (!effectiveJitData) {
      router.back();
      return;
    }

    let parsed: JitData;
    try {
      parsed = JSON.parse(effectiveJitData) as JitData;
    } catch {
      router.back();
      return;
    }

    setCachedJitData(effectiveJitData);

    const { mainLiftSets, warmupSets: ws, auxiliaryWork: aux } = parsed;
    setWarmupSetsState(ws ?? []);

    if (parsed.restRecommendations) {
      restRecommendations.current = parsed.restRecommendations;
    }
    if (parsed.llmRestSuggestion) {
      llmRestSuggestion.current = parsed.llmRestSuggestion;
    }

    // Only re-initialize if this is a different session (guard against re-mount via banner)
    if (currentStoreSessionId !== sessionId) {
      initSession(sessionId, mainLiftSets);

      const activeAux = (aux ?? []).filter((a) => !a.skipped);
      setAuxiliaryWork(aux ?? []);
      if (activeAux.length > 0) {
        initAuxiliary(
          activeAux.map((a) => ({ exercise: a.exercise, sets: a.sets }))
        );
      }

      getSession(sessionId).then((session) => {
        if (!session) {
          router.back();
          return;
        }
        setSessionMeta({
          primary_lift: session.primary_lift,
          intensity_type: session.intensity_type,
          block_number: session.block_number ?? null,
          week_number: session.week_number,
        });
        startSession(sessionId).then(() => {
          void queryClient.invalidateQueries({ queryKey: ['session'] });
        });
      });
    } else {
      // Returning to an existing session — restore aux work display, preserve actualSets
      setAuxiliaryWork(aux ?? []);
      // Restore ad-hoc exercises: any exercise in the store not in prescribed aux
      const prescribed = new Set((aux ?? []).map((a) => a.exercise));
      const adHoc = [
        ...new Set(
          storeState.auxiliarySets
            .filter((s) => !prescribed.has(s.exercise))
            .map((s) => s.exercise)
        ),
      ];
      setAdHocExercises(adHoc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Focus-managed timer interval ───────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      // Catch up on elapsed time if timer is running
      if (timerState?.visible && timerState.timerStartedAt) {
        tickTimer();
        tickIntervalRef.current = setInterval(() => tickTimer(), 1000);
      }

      return () => {
        if (tickIntervalRef.current !== null) {
          clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timerState?.visible, timerState?.timerStartedAt])
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

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
      const wasCompleted = useSessionStore
        .getState()
        .actualSets.find((s) => s.set_number === setNumber)?.is_completed ?? false;

      updateSet(setNumber, {
        weight_grams: Math.round(data.weightKg * 1000),
        reps_completed: data.reps,
        rpe_actual: data.rpe,
        is_completed: data.isCompleted,
      });

      if (data.isCompleted) {
        if (!wasCompleted) {
          setPendingRpeSetNumber(setNumber);
        }

        // No rest timer after the last set
        if (setNumber >= plannedSetsLengthRef.current) return;

        const setIndex = setNumber - 1;
        const duration =
          restRecommendations.current?.mainLift[setIndex] ??
          DEFAULT_MAIN_REST_SECONDS;

        openTimer({
          durationSeconds: duration,
          pendingMainSetNumber: setNumber,
        });
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
      const wasAuxCompleted = useSessionStore
        .getState()
        .auxiliarySets.find((s) => s.exercise === exercise && s.set_number === setNumber)
        ?.is_completed ?? false;

      updateAuxiliarySet(exercise, setNumber, {
        weight_grams: Math.round(data.weightKg * 1000),
        reps_completed: data.reps,
        rpe_actual: data.rpe,
        is_completed: data.isCompleted,
      });

      if (data.isCompleted) {
        if (!wasAuxCompleted) {
          setPendingAuxRpe({ exercise, setNumber });
        }

        // No rest timer after the last set of this exercise
        if (setNumber >= setsInExercise) return;

        const duration =
          restRecommendations.current?.auxiliary[exerciseIndex] ??
          DEFAULT_AUX_REST_SECONDS;

        openTimer({
          durationSeconds: duration,
          pendingAuxExercise: exercise,
          pendingAuxSetNumber: setNumber,
        });
      } else {
        setPendingAuxRpe((prev) =>
          prev?.exercise === exercise && prev?.setNumber === setNumber ? null : prev
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateAuxiliarySet, openTimer]
  );

  function handleTimerDone() {
    // Read pending attribution before closing (closeTimer nulls timerState)
    const pendingMain = timerState?.pendingMainSetNumber ?? null;
    const pendingAuxExercise = timerState?.pendingAuxExercise ?? null;
    const pendingAuxSet = timerState?.pendingAuxSetNumber ?? null;

    const elapsedSeconds = closeTimer();

    if (pendingMain !== null) {
      updateSet(pendingMain, { actual_rest_seconds: elapsedSeconds });
    } else if (pendingAuxExercise !== null && pendingAuxSet !== null) {
      updateAuxiliarySet(pendingAuxExercise, pendingAuxSet, {
        actual_rest_seconds: elapsedSeconds,
      });
    }
  }

  function handleRpeQuickSelect(rpe: number) {
    if (pendingRpeSetNumber !== null) {
      updateSet(pendingRpeSetNumber, { rpe_actual: rpe });
      setPendingRpeSetNumber(null);
    } else if (pendingAuxRpe !== null) {
      updateAuxiliarySet(pendingAuxRpe.exercise, pendingAuxRpe.setNumber, { rpe_actual: rpe });
      setPendingAuxRpe(null);
    }
  }

  function handleRpeQuickSkip() {
    setPendingRpeSetNumber(null);
    setPendingAuxRpe(null);
  }

  function handleConfirmAddExercise(name: string) {
    if (!adHocExercises.includes(name)) {
      setAdHocExercises((prev) => [...prev, name]);
      addAdHocSet(name);
    }
    setAddExerciseVisible(false);
  }

  function handleAddAdHocSet(exercise: string) {
    addAdHocSet(exercise);
  }

  function handleAbandon() {
    Alert.alert(
      'Abandon Workout?',
      'This will reset the session back to planned. Any progress will be lost.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: async () => {
            if (timerState?.visible) closeTimer();
            await abandonSession(sessionId);
            reset();
            void queryClient.invalidateQueries({ queryKey: ['session'] });
            router.replace('/(tabs)/today');
          },
        },
      ]
    );
  }

  function handleComplete() {
    if (timerState?.visible) {
      closeTimer();
    }
    router.push({
      pathname: '/session/complete',
      params: { sessionId },
    });
  }

  const { isOffline } = useNetworkStatus();

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasCompletedSet = actualSets.some((s) => s.is_completed);

  const liftHeader = sessionMeta
    ? `${capitalize(sessionMeta.primary_lift)} — ${capitalize(sessionMeta.intensity_type)}`
    : '';

  const blockWeekLabel = sessionMeta
    ? sessionMeta.block_number !== null
      ? `Block ${sessionMeta.block_number} · Week ${sessionMeta.week_number}`
      : `Week ${sessionMeta.week_number}`
    : '';

  // Label passed to RestTimer: "Block 3 · Heavy" style
  const intensityLabel = sessionMeta
    ? sessionMeta.block_number !== null
      ? `Block ${sessionMeta.block_number} · ${capitalize(sessionMeta.intensity_type)}`
      : capitalize(sessionMeta.intensity_type)
    : '';

  // LLM suggestion is only relevant for main set timers
  const activeLlmSuggestion =
    timerState?.pendingMainSetNumber !== null
      ? (llmRestSuggestion.current ?? undefined)
      : undefined;

  // Group auxiliary sets by exercise for rendering
  const auxByExercise = auxiliaryWork.map((aw) => ({
    ...aw,
    actualSets: auxiliarySets.filter((s) => s.exercise === aw.exercise),
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            No connection — sets saved locally
          </Text>
        </View>
      )}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Session header */}
        <View style={styles.sessionHeader}>
          <View style={styles.sessionHeaderRow}>
            <View style={styles.sessionHeaderText}>
              <Text style={styles.liftTitle}>{liftHeader}</Text>
              <Text style={styles.blockWeekText}>{blockWeekLabel}</Text>
            </View>
            <TouchableOpacity
              onPress={handleAbandon}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Abandon workout"
              accessibilityRole="button"
            >
              <Text style={styles.abandonX}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Warmup section */}
        {warmupSetsState.length > 0 && (
          <WarmupSection
            sets={warmupSetsState}
            completedIndices={warmupCompleted}
            onToggle={setWarmupDone}
            barWeightKg={barWeightKg}
          />
        )}

        {/* Working sets header */}
        <View style={styles.workingSetsHeader}>
          <Text style={styles.workingSetsTitle}>Working Sets</Text>
        </View>

        {/* Set rows */}
        {actualSets.map((actualSet, index) => {
          const planned = plannedSets[index];
          return (
            <SetRow
              key={actualSet.set_number}
              setNumber={actualSet.set_number}
              plannedWeightKg={
                planned?.weight_kg ?? actualSet.weight_grams / 1000
              }
              plannedReps={planned?.reps ?? actualSet.reps_completed}
              rpeValue={actualSet.rpe_actual}
              onUpdate={(data) => handleSetUpdate(actualSet.set_number, data)}
              onRpePress={() => setPendingRpeSetNumber(actualSet.set_number)}
            />
          );
        })}

        {/* Auxiliary work section */}
        {(auxiliaryWork.length > 0 || adHocExercises.length > 0) && (
          <View style={styles.auxSection}>
            <View style={styles.workingSetsHeader}>
              <Text style={styles.workingSetsTitle}>Auxiliary Work</Text>
            </View>

            {auxByExercise.map((aw, exerciseIndex) => (
              <View key={aw.exercise} style={styles.auxExercise}>
                <Text style={styles.auxExerciseName}>
                  {formatExerciseName(aw.exercise)}
                </Text>

                {aw.skipped ? (
                  <Text style={styles.auxSkippedText}>
                    Skipped{aw.skipReason ? ` — ${aw.skipReason}` : ''}
                  </Text>
                ) : (
                  aw.actualSets.map((actualSet) => {
                    const planned = aw.sets[actualSet.set_number - 1];
                    return (
                      <SetRow
                        key={`${aw.exercise}-${actualSet.set_number}`}
                        setNumber={actualSet.set_number}
                        plannedWeightKg={
                          planned?.weight_kg ?? actualSet.weight_grams / 1000
                        }
                        plannedReps={planned?.reps ?? actualSet.reps_completed}
                        rpeValue={actualSet.rpe_actual}
                        exerciseType={aw.exerciseType}
                        onRpePress={() =>
                          setPendingAuxRpe({ exercise: aw.exercise, setNumber: actualSet.set_number })
                        }
                        onUpdate={(data) =>
                          handleAuxSetUpdate(
                            exerciseIndex,
                            aw.exercise,
                            actualSet.set_number,
                            aw.sets.length,
                            data
                          )
                        }
                      />
                    );
                  })
                )}
              </View>
            ))}

            {adHocExercises.map((exercise, exerciseIndex) => {
              const sets = auxiliarySets.filter((s) => s.exercise === exercise);
              return (
                <View key={exercise} style={styles.auxExercise}>
                  <View style={styles.adHocExerciseHeader}>
                    <Text style={styles.auxExerciseName}>
                      {formatExerciseName(exercise)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleAddAdHocSet(exercise)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={`Add set for ${exercise}`}
                      accessibilityRole="button"
                    >
                      <Text style={styles.addSetButton}>+ Set</Text>
                    </TouchableOpacity>
                  </View>
                  {sets.map((actualSet) => (
                    <SetRow
                      key={`${exercise}-${actualSet.set_number}`}
                      setNumber={actualSet.set_number}
                      plannedWeightKg={actualSet.weight_grams / 1000}
                      plannedReps={actualSet.reps_completed}
                      rpeValue={actualSet.rpe_actual}
                      onRpePress={() =>
                        setPendingAuxRpe({ exercise, setNumber: actualSet.set_number })
                      }
                      onUpdate={(data) =>
                        handleAuxSetUpdate(
                          auxByExercise.length + exerciseIndex,
                          exercise,
                          actualSet.set_number,
                          sets.length,
                          data
                        )
                      }
                    />
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Add exercise button */}
        <TouchableOpacity
          style={styles.addExerciseButton}
          onPress={() => setAddExerciseVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel="Add exercise"
          accessibilityRole="button"
        >
          <Text style={styles.addExerciseButtonText}>+ Add Exercise</Text>
        </TouchableOpacity>

        {/* Bottom padding for sticky button */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Sticky footer: complete */}
      <View style={styles.stickyFooter}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            !hasCompletedSet && styles.completeButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={!hasCompletedSet}
          activeOpacity={0.8}
          accessible
          accessibilityLabel="Complete workout"
          accessibilityRole="button"
        >
          <Text style={styles.completeButtonText}>Complete Workout</Text>
        </TouchableOpacity>
      </View>

      {/* Mini lift history sheet */}
      <LiftHistorySheet
        lift={sessionMeta?.primary_lift ?? ''}
        visible={historySheetVisible}
        onClose={() => setHistorySheetVisible(false)}
      />

      {/* Add exercise modal */}
      <AddExerciseModal
        visible={addExerciseVisible}
        onConfirm={handleConfirmAddExercise}
        onClose={() => setAddExerciseVisible(false)}
      />

      {/* Rest timer + floating RPE picker overlay */}
      {(timerState?.visible || pendingRpeSetNumber !== null || pendingAuxRpe !== null) && (
        <View
          pointerEvents="box-none"
          style={[styles.restTimerOverlay, { top: insets.top + 8 }]}
        >
          {timerState?.visible && (
            <RestTimer
              durationSeconds={
                timerState?.durationSeconds ?? DEFAULT_MAIN_REST_SECONDS
              }
              elapsed={timerState?.elapsed ?? 0}
              offset={timerState?.offset ?? 0}
              onAdjust={adjustTimer}
              llmSuggestion={activeLlmSuggestion}
              onDone={handleTimerDone}
              intensityLabel={intensityLabel}
            />
          )}
          {(pendingRpeSetNumber !== null || pendingAuxRpe !== null) && (
            <View style={timerState?.visible ? styles.rpePickerSpaced : undefined}>
              <RpeQuickPicker
                onSelect={handleRpeQuickSelect}
                onSkip={handleRpeQuickSkip}
              />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgSurface,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingBottom: 16,
  },
  sessionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sessionHeaderText: {
    flex: 1,
  },
  abandonX: {
    fontSize: 18,
    color: colors.textTertiary,
    lineHeight: 22,
    paddingLeft: 8,
  },
  liftTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  blockWeekText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  workingSetsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  workingSetsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  auxSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  auxExercise: {
    marginBottom: 8,
  },
  auxExerciseName: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  auxSkippedText: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  adHocExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  addSetButton: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  addExerciseButton: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addExerciseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  bottomSpacer: {
    height: 100,
  },
  stickyFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  completeButtonDisabled: {
    opacity: 0.4,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
  restTimerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  rpePickerSpaced: {
    width: '100%',
    maxWidth: 560,
  },
  offlineBanner: {
    backgroundColor: colors.warning,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offlineBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textInverse,
    textAlign: 'center',
  },
});
