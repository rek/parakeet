import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFeatureEnabled } from '@modules/feature-flags';
import { useLiftHistory } from '@modules/history';
import { computeDisplayWeights, useChallengeReview } from '@modules/jit';
import { getProfile } from '@modules/profile';
import {
  abandonSession,
  AddExerciseModal,
  buildBlockWeekLabel,
  buildIntensityLabel,
  buildNextLiftLabel,
  buildRpeContextLabel,
  computeSuggestedAux,
  computeSuggestedWeight,
  DEFAULT_MAIN_REST_SECONDS,
  fetchRecentAuxExerciseNames,
  formatExerciseName,
  getSession,
  groupAuxiliaryWork,
  LiftHistorySheet,
  PostRestOverlay,
  RestTimer,
  RpeQuickPicker,
  SetRow,
  startSession,
  useSetCompletionFlow,
  VolumeRecoveryBanner,
  WarmupSection,
  WeightSuggestionBanner,
  formatPrescriptionTrace,
  parsePrescriptionTrace,
} from '@modules/session';
import type {
  AuxiliaryWork,
  JitData,
  LlmRestSuggestion,
  RestRecommendations,
  WarmupSet,
} from '@modules/session';
import {
  getBarWeightKg,
  getDisabledPlates,
  getRestTimerPrefs,
  getWarmupPlateDisplay,
  setBarWeightKg,
  setDisabledPlates,
} from '@modules/settings';
import type { RestTimerPrefs, WarmupPlateDisplay } from '@modules/settings';
import type { Lift } from '@parakeet/shared-types';
import { useNetworkStatus } from '@platform/network';
import { useSessionStore } from '@platform/store/sessionStore';
import { captureException } from '@platform/utils/captureException';
import type { PlateKg } from '@shared/constants/plates';
import { getAllExercises, getExerciseType } from '@shared/utils/exercise-lookup';
import { sessionLabel } from '@shared/utils/string';
import { weightGramsToKg } from '@shared/utils/weight';
import { useQueryClient } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

// ── Styles ───────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bgSurface,
    },
    scrollView: {
      flex: 1,
    },
    container: {
      paddingBottom: 0,
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
    topUpDivider: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 4,
    },
    topUpDividerText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    topUpReason: {
      paddingHorizontal: 16,
      paddingBottom: 6,
      fontSize: 12,
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
    adHocSetRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    adHocSetRowContent: {
      flex: 1,
    },
    removeSetButton: {
      paddingHorizontal: 6,
      paddingVertical: 4,
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
    completeButton: {
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 32,
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
    overlaySpaced: {
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
    adaptationBanner: {
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.warningMuted,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    adaptationBannerText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.warning,
    },
    challengeBanner: {
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.warningMuted,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    challengeBannerRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    challengeBannerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.warning,
    },
    challengeDismiss: {
      paddingLeft: 8,
      fontSize: 13,
      color: colors.textTertiary,
    },
    challengeDetail: {
      marginTop: 6,
      fontSize: 12,
      color: colors.warning,
      lineHeight: 18,
    },
  });
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SessionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { sessionId, jitData, openHistory, freeForm } = useLocalSearchParams<{
    sessionId: string;
    jitData: string;
    openHistory?: string;
    freeForm?: string;
  }>();

  const isFreeForm = freeForm === '1';
  useKeepAwake();

  const {
    actualSets,
    auxiliarySets,
    plannedSets,
    warmupCompleted,
    sessionMeta,
    timerState,
    currentAdaptation,
    auxAdaptations,
    recoveryOffer,
    acceptRecovery,
    dismissRecovery,
    weightSuggestion,
    acceptWeightSuggestion,
    dismissWeightSuggestion,
    initSession,
    initAuxiliary,
    addAdHocSet,
    removeAdHocSet,
    setWarmupDone,
    setSessionMeta,
    setCachedJitData,
    openTimer,
    tickTimer,
    adjustTimer,
    closeTimer,
    resetAdaptation,
    reset,
  } = useSessionStore();

  const queryClient = useQueryClient();

  const [warmupSetsState, setWarmupSetsState] = useState<WarmupSet[]>([]);
  const [auxiliaryWork, setAuxiliaryWork] = useState<AuxiliaryWork[]>([]);
  const [adHocExercises, setAdHocExercises] = useState<string[]>([]);
  const [equipmentBarWeightKg, setEquipmentBarWeightKg] = useState<number>(20);
  const [equipmentDisabledPlates, setEquipmentDisabledPlates] = useState<
    PlateKg[]
  >([]);
  const [warmupPlateDisplay, setWarmupPlateDisplay] =
    useState<WarmupPlateDisplay>('numbers');
  const [addExerciseVisible, setAddExerciseVisible] = useState(false);
  const [historySheetVisible, setHistorySheetVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const traceEnabled = useFeatureEnabled('prescriptionTrace');
  const cachedTrace = useSessionStore((s) => s.cachedPrescriptionTrace);
  const formattedTrace = useMemo(() => {
    if (!cachedTrace) return null;
    try {
      const raw = parsePrescriptionTrace(JSON.parse(cachedTrace));
      return raw ? formatPrescriptionTrace(raw) : null;
    } catch {
      return null;
    }
  }, [cachedTrace]);

  // Auto-open history sheet when banner navigates back with openHistory param
  useEffect(() => {
    if (openHistory === '1') setHistorySheetVisible(true);
  }, [openHistory]);

  // Mirror plannedSets.length in a ref so stable callbacks see the current value
  const plannedSetsLengthRef = useRef(0);
  useEffect(() => {
    plannedSetsLengthRef.current = plannedSets.length;
  }, [plannedSets.length]);

  // Clear adaptation when all main sets are completed (user moves to auxiliary work)
  useEffect(() => {
    if (
      currentAdaptation !== null &&
      actualSets.length > 0 &&
      actualSets.every((s) => s.is_completed)
    ) {
      resetAdaptation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualSets]);

  // Rest recommendations extracted from jit output (re-populated on each mount)
  const restRecommendations = useRef<RestRecommendations | null>(null);
  const llmRestSuggestion = useRef<LlmRestSuggestion | null>(null);

  // Intra-session adaptation context — set once from parsed JIT data
  const oneRmKgRef = useRef<number | undefined>(undefined);
  const biologicalSexRef = useRef<'male' | 'female' | undefined>(undefined);

  // Timer prefs loaded once on mount
  const restTimerPrefsRef = useRef<RestTimerPrefs>({
    audioAlert: true,
    hapticAlert: true,
    llmSuggestions: true,
    backgroundRestNotification: true,
    mainSetsEnabled: true,
    auxSetsEnabled: true,
    postWarmupEnabled: true,
    postWarmupSeconds: 120,
  });

  // Interval ref for focus-managed timer ticking
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Set completion flow (rest timer → overlay → RPE) ──────────────────────

  const {
    postRestState,
    pendingRpeSetNumber,
    pendingAuxRpe,
    pendingAuxConfirmation,
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
    clearPostRestState,
  } = useSetCompletionFlow({
    restTimerPrefsRef,
    restRecommendations,
    auxiliaryWork,
    plannedSetsLengthRef,
    oneRmKgRef,
    biologicalSexRef,
  });

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    getRestTimerPrefs().then((p) => {
      restTimerPrefsRef.current = p;
    });
    getProfile()
      .then((profile) => getBarWeightKg(profile?.biological_sex))
      .then(setEquipmentBarWeightKg);
    getDisabledPlates().then(setEquipmentDisabledPlates);
    getWarmupPlateDisplay().then(setWarmupPlateDisplay);
    return () => {
      cleanupResetInterval();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBarWeightChange(kg: number) {
    setEquipmentBarWeightKg(kg);
    try {
      await setBarWeightKg(kg as 20 | 15);
    } catch (err) {
      captureException(err);
    }
  }

  async function handleDisabledPlatesChange(plates: PlateKg[]) {
    setEquipmentDisabledPlates(plates);
    try {
      await setDisabledPlates(plates);
    } catch (err) {
      captureException(err);
    }
  }

  useEffect(() => {
    if (!sessionId) {
      router.back();
      return;
    }

    // Read current store state directly — avoids stale closure from first render
    // (Zustand may not have finished hydrating from AsyncStorage at render time)
    const storeState = useSessionStore.getState();
    const currentStoreSessionId = storeState.sessionId;

    // Free-form ad-hoc: no JIT data needed, start with empty session
    if (isFreeForm) {
      if (currentStoreSessionId !== sessionId) {
        initSession(sessionId, []);

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
            activity_name: session.activity_name,
          });
          void queryClient.invalidateQueries({ queryKey: ['session'] });
        });
      } else {
        // Resuming free-form: restore ad-hoc exercises from store
        const adHoc = [
          ...new Set(storeState.auxiliarySets.map((s) => s.exercise)),
        ];
        setAdHocExercises(adHoc);
      }
      return;
    }

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
    if (parsed.oneRmKg != null) {
      oneRmKgRef.current = parsed.oneRmKg;
    }

    // Re-initialize if this is a different session OR if JIT data changed for the
    // same session (e.g. user re-ran soreness check-in → new weights from JIT).
    // Compare first planned weight to detect stale store data.
    const storeWeight = storeState.actualSets[0]?.weight_grams;
    const jitWeight = mainLiftSets[0]
      ? Math.round(mainLiftSets[0].weight_kg * 1000)
      : undefined;
    const jitDataChanged =
      currentStoreSessionId === sessionId &&
      jitWeight !== undefined &&
      storeWeight !== jitWeight;

    if (currentStoreSessionId !== sessionId || jitDataChanged) {
      initSession(sessionId, mainLiftSets);

      const activeAux = (aux ?? []).filter((a) => !a.skipped);
      setAuxiliaryWork(aux ?? []);
      if (activeAux.length > 0) {
        initAuxiliary(
          activeAux.map((a) => ({
            exercise: a.exercise,
            sets: a.sets,
            exerciseType: a.exerciseType,
          }))
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

  // ── Exercise suggestions ──────────────────────────────────────────────────

  const exerciseCatalog = useMemo(() => getAllExercises(), []);
  const [recentAuxNames, setRecentAuxNames] = useState<string[]>([]);
  useEffect(() => {
    fetchRecentAuxExerciseNames()
      .then(setRecentAuxNames)
      .catch(captureException);
  }, []);

  const alreadyInSession = useMemo(
    () => [...auxiliaryWork.map((aw) => aw.exercise), ...adHocExercises],
    [auxiliaryWork, adHocExercises]
  );

  const suggestedExerciseNames = useMemo(
    () =>
      computeSuggestedAux(
        (sessionMeta?.primary_lift as Lift | null) ?? null,
        alreadyInSession,
        exerciseCatalog
      ),
    [alreadyInSession, sessionMeta?.primary_lift, exerciseCatalog]
  );

  // ── Screen-local handlers ─────────────────────────────────────────────────

  function handleConfirmAddExercise(name: string) {
    if (!adHocExercises.includes(name)) {
      setAdHocExercises((prev) => [...prev, name]);
      const oneRmGrams =
        oneRmKgRef.current != null ? Math.round(oneRmKgRef.current * 1000) : 0;
      const suggestedWeight =
        oneRmGrams > 0
          ? computeSuggestedWeight(name, oneRmGrams, exerciseCatalog)
          : 0;
      addAdHocSet(name, suggestedWeight, getExerciseType(name));
    }
    setAddExerciseVisible(false);
  }

  function handleAddAdHocSet(exercise: string) {
    addAdHocSet(exercise, undefined, getExerciseType(exercise));
  }

  function handleRemoveAdHocSet(exercise: string, setNumber: number) {
    const remaining = auxiliarySets.filter(
      (s) => s.exercise === exercise && !(s.set_number === setNumber)
    );
    if (remaining.length === 0) {
      setAdHocExercises((prev) => prev.filter((e) => e !== exercise));
    }
    removeAdHocSet(exercise, setNumber);
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
            cleanupResetInterval();
            clearPostRestState();
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

  const {
    data: liftHistoryData,
    isLoading: liftHistoryLoading,
    isError: liftHistoryError,
  } = useLiftHistory(sessionMeta?.primary_lift ?? '', historySheetVisible);

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasCompletedSet =
    actualSets.some((s) => s.is_completed) ||
    auxiliarySets.some((s) => s.is_completed);

  const liftHeader = sessionMeta ? sessionLabel(sessionMeta) : '';
  const blockWeek = buildBlockWeekLabel(sessionMeta);
  const intensity = buildIntensityLabel(sessionMeta);

  // LLM suggestion is only relevant for main set timers
  const activeLlmSuggestion =
    timerState?.pendingMainSetNumber !== null
      ? (llmRestSuggestion.current ?? undefined)
      : undefined;

  const { regularAux, topUpAux } = groupAuxiliaryWork(
    auxiliaryWork,
    auxiliarySets
  );
  const auxCount = regularAux.length + topUpAux.length;

  // ── Challenge review banner ─────────────────────────────────────────────
  const [challengeDismissed, setChallengeDismissed] = useState(false);
  const [challengeExpanded, setChallengeExpanded] = useState(false);
  const { data: challengeReview } = useChallengeReview(
    sessionId,
    !isFreeForm && !challengeDismissed
  );
  const showChallengeBanner =
    !challengeDismissed &&
    challengeReview?.verdict === 'flag' &&
    (challengeReview?.concerns.length ?? 0) > 0;

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
              <Text style={styles.blockWeekText}>{blockWeek}</Text>
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

        {/* Challenge review banner */}
        {showChallengeBanner && (
          <TouchableOpacity
            style={styles.challengeBanner}
            onPress={() => setChallengeExpanded(!challengeExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.challengeBannerRow}>
              <Text style={styles.challengeBannerText}>
                {challengeReview?.concerns[0]}
              </Text>
              <TouchableOpacity
                onPress={() => setChallengeDismissed(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.challengeDismiss}>✕</Text>
              </TouchableOpacity>
            </View>
            {challengeExpanded &&
              challengeReview?.concerns.slice(1).map((concern, i) => (
                <Text key={i} style={styles.challengeDetail}>
                  {concern}
                </Text>
              ))}
          </TouchableOpacity>
        )}

        {/* Warmup section */}
        {warmupSetsState.length > 0 && (
          <WarmupSection
            sets={warmupSetsState}
            completedIndices={warmupCompleted}
            barWeightKg={equipmentBarWeightKg}
            disabledPlates={equipmentDisabledPlates}
            plateDisplay={warmupPlateDisplay}
            onToggle={(index, done) => {
              setWarmupDone(index, done);
              if (
                done &&
                index === warmupSetsState.length - 1 &&
                restTimerPrefsRef.current.postWarmupEnabled
              ) {
                openTimer({
                  durationSeconds: restTimerPrefsRef.current.postWarmupSeconds,
                });
              }
            }}
          />
        )}

        {/* Working sets header + rows (hidden for free-form) */}
        {actualSets.length > 0 && (
          <>
            <View style={styles.workingSetsHeader}>
              <Text style={styles.workingSetsTitle}>Working Sets</Text>
            </View>

            {/* Intra-session adaptation banner */}
            {currentAdaptation !== null &&
              (currentAdaptation.adaptationType === 'weight_reduced' ||
                currentAdaptation.adaptationType === 'sets_capped') && (
                <View style={styles.adaptationBanner}>
                  <Text style={styles.adaptationBannerText}>
                    {currentAdaptation.rationale}
                  </Text>
                </View>
              )}

            {computeDisplayWeights(
              actualSets,
              plannedSets,
              currentAdaptation
            ).map(({ displayWeightKg, originalIndex }) => {
              const actualSet = actualSets[originalIndex];
              const planned = plannedSets[originalIndex];
              return (
                <SetRow
                  key={actualSet.set_number}
                  setNumber={actualSet.set_number}
                  plannedWeightKg={
                    actualSet.is_completed
                      ? weightGramsToKg(actualSet.weight_grams)
                      : displayWeightKg
                  }
                  plannedReps={
                    actualSet.is_completed
                      ? actualSet.reps_completed
                      : (planned?.reps ?? actualSet.reps_completed)
                  }
                  rpeValue={actualSet.rpe_actual}
                  isCompleted={actualSet.is_completed}
                  onUpdate={(data) =>
                    handleSetUpdate(actualSet.set_number, data)
                  }
                  onRpePress={() => requestMainRpe(actualSet.set_number)}
                  barWeightKg={equipmentBarWeightKg}
                  disabledPlates={equipmentDisabledPlates}
                  onBarWeightChange={handleBarWeightChange}
                  onDisabledPlatesChange={handleDisabledPlatesChange}
                  prescriptionTrace={
                    traceEnabled ? formattedTrace : undefined
                  }
                />
              );
            })}
          </>
        )}

        {/* Volume recovery banner */}
        {recoveryOffer !== null && (
          <VolumeRecoveryBanner
            offer={recoveryOffer}
            colors={colors}
            onAccept={() => {
              acceptRecovery();
              plannedSetsLengthRef.current =
                useSessionStore.getState().plannedSets.length;
            }}
            onDismiss={dismissRecovery}
          />
        )}

        {/* Weight autoregulation suggestion */}
        {weightSuggestion !== null && (
          <WeightSuggestionBanner
            suggestion={weightSuggestion}
            colors={colors}
            onAccept={acceptWeightSuggestion}
            onDismiss={dismissWeightSuggestion}
          />
        )}

        {/* Auxiliary work section */}
        {(auxiliaryWork.length > 0 || adHocExercises.length > 0) && (
          <View style={styles.auxSection}>
            <View style={styles.workingSetsHeader}>
              <Text style={styles.workingSetsTitle}>Auxiliary Work</Text>
            </View>

            {regularAux.map((aw) => {
              const auxAdapt = auxAdaptations[aw.exercise];
              return (
                <View key={aw.exercise} style={styles.auxExercise}>
                  <Text style={styles.auxExerciseName}>
                    {formatExerciseName(aw.exercise)}
                  </Text>

                  {auxAdapt?.adaptationType === 'weight_reduced' && (
                    <View style={styles.adaptationBanner}>
                      <Text style={styles.adaptationBannerText}>
                        {auxAdapt.rationale}
                      </Text>
                    </View>
                  )}

                  {aw.skipped ? (
                    <Text style={styles.auxSkippedText}>
                      Skipped{aw.skipReason ? ` — ${aw.skipReason}` : ''}
                    </Text>
                  ) : (
                    aw.actualSets.map((actualSet) => {
                      const planned = aw.sets[actualSet.set_number - 1];
                      const adaptedSet = auxAdapt?.sets.find(
                        (s) => s.set_number === actualSet.set_number
                      );
                      return (
                        <SetRow
                          key={`${aw.exercise}-${actualSet.set_number}`}
                          setNumber={actualSet.set_number}
                          plannedWeightKg={
                            actualSet.is_completed
                              ? weightGramsToKg(actualSet.weight_grams)
                              : (adaptedSet?.weight_kg ??
                                planned?.weight_kg ??
                                actualSet.weight_grams / 1000)
                          }
                          plannedReps={
                            actualSet.is_completed
                              ? actualSet.reps_completed
                              : (planned?.reps ?? actualSet.reps_completed)
                          }
                          rpeValue={actualSet.rpe_actual}
                          isCompleted={actualSet.is_completed}
                          exerciseType={aw.exerciseType}
                          onRpePress={() =>
                            requestAuxRpe(aw.exercise, actualSet.set_number)
                          }
                          onUpdate={(data) =>
                            handleAuxSetUpdate(
                              aw.origIndex,
                              aw.exercise,
                              actualSet.set_number,
                              aw.sets.length,
                              data
                            )
                          }
                          barWeightKg={equipmentBarWeightKg}
                          disabledPlates={equipmentDisabledPlates}
                          onBarWeightChange={handleBarWeightChange}
                          onDisabledPlatesChange={handleDisabledPlatesChange}
                        />
                      );
                    })
                  )}
                </View>
              );
            })}

            {topUpAux.length > 0 && (
              <>
                <View style={styles.topUpDivider}>
                  <Text style={styles.topUpDividerText}>Volume top-up</Text>
                </View>
                {topUpAux.map((aw) => {
                  const auxAdapt = auxAdaptations[aw.exercise];
                  return (
                    <View key={aw.exercise} style={styles.auxExercise}>
                      <Text style={styles.auxExerciseName}>
                        {formatExerciseName(aw.exercise)}
                      </Text>
                      {aw.topUpReason && (
                        <Text style={styles.topUpReason}>{aw.topUpReason}</Text>
                      )}
                      {auxAdapt?.adaptationType === 'weight_reduced' && (
                        <View style={styles.adaptationBanner}>
                          <Text style={styles.adaptationBannerText}>
                            {auxAdapt.rationale}
                          </Text>
                        </View>
                      )}
                      {aw.skipped ? (
                        <Text style={styles.auxSkippedText}>
                          Skipped{aw.skipReason ? ` — ${aw.skipReason}` : ''}
                        </Text>
                      ) : (
                        aw.actualSets.map((actualSet) => {
                          const planned = aw.sets[actualSet.set_number - 1];
                          const adaptedSet = auxAdapt?.sets.find(
                            (s) => s.set_number === actualSet.set_number
                          );
                          return (
                            <SetRow
                              key={`${aw.exercise}-${actualSet.set_number}`}
                              setNumber={actualSet.set_number}
                              plannedWeightKg={
                                actualSet.is_completed
                                  ? weightGramsToKg(actualSet.weight_grams)
                                  : (adaptedSet?.weight_kg ??
                                    planned?.weight_kg ??
                                    actualSet.weight_grams / 1000)
                              }
                              plannedReps={
                                actualSet.is_completed
                                  ? actualSet.reps_completed
                                  : (planned?.reps ?? actualSet.reps_completed)
                              }
                              rpeValue={actualSet.rpe_actual}
                              exerciseType={aw.exerciseType}
                              onRpePress={() =>
                                requestAuxRpe(aw.exercise, actualSet.set_number)
                              }
                              onUpdate={(data) =>
                                handleAuxSetUpdate(
                                  aw.origIndex,
                                  aw.exercise,
                                  actualSet.set_number,
                                  aw.sets.length,
                                  data
                                )
                              }
                              barWeightKg={equipmentBarWeightKg}
                              disabledPlates={equipmentDisabledPlates}
                              onBarWeightChange={handleBarWeightChange}
                              onDisabledPlatesChange={
                                handleDisabledPlatesChange
                              }
                            />
                          );
                        })
                      )}
                    </View>
                  );
                })}
              </>
            )}

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
                    <View
                      key={`${exercise}-${actualSet.set_number}`}
                      style={styles.adHocSetRow}
                    >
                      <View style={styles.adHocSetRowContent}>
                        <SetRow
                          setNumber={actualSet.set_number}
                          plannedWeightKg={actualSet.weight_grams / 1000}
                          plannedReps={actualSet.reps_completed}
                          rpeValue={actualSet.rpe_actual}
                          exerciseType={getExerciseType(exercise)}
                          onRpePress={() =>
                            requestAuxRpe(exercise, actualSet.set_number)
                          }
                          onUpdate={(data) =>
                            handleAuxSetUpdate(
                              auxCount + exerciseIndex,
                              exercise,
                              actualSet.set_number,
                              sets.length,
                              data
                            )
                          }
                          barWeightKg={equipmentBarWeightKg}
                          disabledPlates={equipmentDisabledPlates}
                          onBarWeightChange={handleBarWeightChange}
                          onDisabledPlatesChange={handleDisabledPlatesChange}
                        />
                      </View>
                      {!actualSet.is_completed && (
                        <TouchableOpacity
                          style={styles.removeSetButton}
                          onPress={() =>
                            handleRemoveAdHocSet(exercise, actualSet.set_number)
                          }
                          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                          accessibilityLabel={`Remove set ${actualSet.set_number}`}
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name="close-circle"
                            size={18}
                            color={colors.textTertiary}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
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

        {/* Complete workout button — inline, must scroll to reach */}
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
      </ScrollView>

      {/* Mini lift history sheet */}
      <LiftHistorySheet
        lift={sessionMeta?.primary_lift ?? ''}
        visible={historySheetVisible}
        onClose={() => setHistorySheetVisible(false)}
        data={liftHistoryData}
        isLoading={liftHistoryLoading}
        isError={liftHistoryError}
        isOffline={isOffline}
      />

      {/* Add exercise modal */}
      <AddExerciseModal
        visible={addExerciseVisible}
        onConfirm={handleConfirmAddExercise}
        onClose={() => setAddExerciseVisible(false)}
        defaultLift={sessionMeta?.primary_lift as Lift | undefined}
        suggestedNames={suggestedExerciseNames}
        recentNames={recentAuxNames}
        excludeNames={alreadyInSession}
      />

      {/* RPE picker (primary) + rest timer + post-rest overlay */}
      {(timerState?.visible ||
        postRestState !== null ||
        pendingRpeSetNumber !== null ||
        pendingAuxRpe !== null ||
        pendingAuxConfirmation !== null) && (
        <View
          pointerEvents="box-none"
          style={[styles.restTimerOverlay, { top: insets.top + 8 }]}
        >
          {pendingAuxConfirmation !== null && (
            <PostRestOverlay
              plannedReps={pendingAuxConfirmation.reps}
              plannedWeightKg={weightGramsToKg(
                pendingAuxConfirmation.weightGrams
              )}
              nextSetNumber={pendingAuxConfirmation.setNumber}
              onLiftComplete={handleAuxConfirmComplete}
              onLiftFailed={handleAuxConfirmFailed}
              onReset15s={() => {}}
              resetCountdown={null}
              isConfirmation
            />
          )}
          {(pendingRpeSetNumber !== null || pendingAuxRpe !== null) && (
            <RpeQuickPicker
              onSelect={handleRpeQuickSelect}
              onSkip={handleRpeQuickSkip}
              contextLabel={buildRpeContextLabel({
                pendingRpeSetNumber,
                pendingAuxRpe,
                actualSets,
                auxiliarySets,
                auxiliaryWork,
                plannedSetsCount: plannedSets.length,
              })}
            />
          )}
          {timerState?.visible && (
            <View
              style={
                pendingRpeSetNumber !== null || pendingAuxRpe !== null
                  ? styles.overlaySpaced
                  : undefined
              }
            >
              <RestTimer
                durationSeconds={
                  timerState?.durationSeconds ?? DEFAULT_MAIN_REST_SECONDS
                }
                elapsed={timerState?.elapsed ?? 0}
                offset={timerState?.offset ?? 0}
                onAdjust={adjustTimer}
                llmSuggestion={activeLlmSuggestion}
                onDone={handleTimerDone}
                intensityLabel={intensity}
                autoHideOnExpiry
                bonusSeconds={
                  timerState?.pendingMainSetNumber !== null &&
                  currentAdaptation?.adaptationType === 'extended_rest'
                    ? (currentAdaptation.restBonusSeconds ?? 0)
                    : 0
                }
                audioAlert={restTimerPrefsRef.current.audioAlert}
                hapticAlert={restTimerPrefsRef.current.hapticAlert}
                nextLiftLabel={
                  pendingRpeSetNumber !== null || pendingAuxRpe !== null
                    ? undefined
                    : buildNextLiftLabel({
                        pendingMainSetNumber:
                          timerState?.pendingMainSetNumber ?? null,
                        plannedSets,
                        pendingAuxExercise:
                          timerState?.pendingAuxExercise ?? null,
                        pendingAuxSetNumber:
                          timerState?.pendingAuxSetNumber ?? null,
                        auxiliaryWork,
                      })
                }
              />
            </View>
          )}
          {postRestState !== null && !timerState?.visible && (
            <PostRestOverlay
              plannedReps={postRestState.plannedReps}
              plannedWeightKg={postRestState.plannedWeightKg}
              nextSetNumber={postRestState.nextSetNumber}
              onLiftComplete={handleLiftComplete}
              onLiftFailed={handleLiftFailed}
              onReset15s={handlePostRestReset}
              resetCountdown={postRestState.resetSecondsRemaining}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
