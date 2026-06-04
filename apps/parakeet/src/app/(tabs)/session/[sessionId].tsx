import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@modules/auth';
import { useFeatureEnabled } from '@modules/feature-flags';
import { LiftHistorySheet, useLiftHistory } from '@modules/history';
import {
  computeDisplayWeights,
  revertSessionToFormula,
  useChallengeReview,
} from '@modules/jit';
import { getProfile } from '@modules/profile';
import { useRehabCapForLift } from '@modules/rehab-mode';
import type { WorkoutTemplateWithItems } from '@modules/workout-templates';
import { AddExerciseModal } from '@shared/ui/AddExerciseModal';
import {
  abandonSession,
  AddWorkoutTemplateModal,
  AuxAnchorNote,
  AuxTemplateBlock,
  BackgroundTimerBadge,
  expandTemplate,
  buildBlockWeekLabel,
  buildIntensityLabel,
  buildNextLiftLabel,
  buildRpeContextLabel,
  computeSuggestedAux,
  computeSuggestedWeight,
  DEFAULT_MAIN_REST_SECONDS,
  formatExerciseName,
  formatPrescriptionTrace,
  getRecentAuxExerciseNames,
  groupAuxiliaryWork,
  groupTemplateBlocks,
  parsePrescriptionTrace,
  PostRestOverlay,
  RestTimer,
  RpeQuickPicker,
  selectPostRestWeight,
  SetRow,
  useSessionBootstrap,
  useSessionLifecycle,
  useSessionStore,
  useSetCompletionFlow,
  useSetPersistence,
  VolumeRecoveryBanner,
  WarmupSection,
  WeightSuggestionBanner,
} from '@modules/session';
import type {
  LlmRestSuggestion,
  RestRecommendations,
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
import {
  PostRestRecordButton,
  SetVideoIcon,
  usePostRestVideoCapture,
} from '@modules/video-analysis';
import type { Lift, MuscleGroup } from '@parakeet/shared-types';
import {
  plateIncrementKg,
  type AuxiliaryWork,
  type ExerciseType,
  type PrescriptionTrace,
} from '@parakeet/training-engine';
import { toJson } from '@platform/supabase';
import { useNetworkStatus } from '@platform/network';
import { captureException } from '@platform/utils/captureException';
import type { PlateKg } from '@shared/constants/plates';
import { ExerciseName } from '@shared/ui/ExerciseName';
import {
  getAllExercises,
  getExerciseType,
} from '@shared/utils/exercise-lookup';
import { sessionLabel } from '@shared/utils/string';
import { weightGramsToKg } from '@shared/utils/weight';
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
    liftTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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
    revertBanner: {
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.warningMuted,
      borderWidth: 1,
      borderColor: colors.warning,
      gap: 8,
    },
    revertBannerText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.warning,
    },
    revertButton: {
      alignSelf: 'flex-start' as const,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    revertButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textInverse,
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
    auxiliaryWork,
    plannedSets,
    warmupCompleted,
    sessionMeta,
    timers,
    activeTimerKey,
    currentAdaptation,
    auxAdaptations,
    pendingRpeSetNumber,
    pendingAuxRpe,
    pendingAuxConfirmation,
    recoveryOffer,
    acceptRecovery,
    dismissRecovery,
    weightSuggestion,
    acceptWeightSuggestion,
    dismissWeightSuggestion,
    addAdHocSet,
    removeAdHocSet,
    addTemplateBlock,
    removeTemplateBlock,
    setWarmupDone,
    openTimer,
    tickTimer,
    adjustTimer,
    closeTimer,
    switchActiveTimer,
    completeExpiredTimers,
    resetAdaptation,
    reset,
  } = useSessionStore();

  // Derive from destructured state — no extra Zustand selectors needed since
  // the full-store destructure above already triggers re-renders on tick.
  const activeTimer = activeTimerKey ? (timers[activeTimerKey] ?? null) : null;
  const timerCount = Object.keys(timers).length;
  const backgroundTimerEntries = useMemo(
    () =>
      Object.entries(timers)
        .filter(([key]) => key !== activeTimerKey)
        .map(([key, timer]) => ({ key, timer })),
    [timers, activeTimerKey]
  );
  const postRestState = useSessionStore((s) => s.postRestQueue[0] ?? null);

  const { user } = useAuth();
  useSetPersistence(user?.id);

  const { invalidateSessionCache } = useSessionLifecycle();

  const [equipmentBarWeightKg, setEquipmentBarWeightKg] = useState<number>(20);
  const [equipmentDisabledPlates, setEquipmentDisabledPlates] = useState<
    PlateKg[]
  >([]);
  const [warmupPlateDisplay, setWarmupPlateDisplay] =
    useState<WarmupPlateDisplay>('numbers');
  const [addExerciseVisible, setAddExerciseVisible] = useState(false);
  const [addWorkoutVisible, setAddWorkoutVisible] = useState(false);
  const [historySheetVisible, setHistorySheetVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const traceEnabled = useFeatureEnabled('prescriptionTrace');
  const cachedTrace = useSessionStore((s) => s.cachedPrescriptionTrace);
  const formattedTrace = useMemo(() => {
    if (!cachedTrace) return null;
    const raw = parsePrescriptionTrace(cachedTrace);
    return raw ? formatPrescriptionTrace(raw) : null;
  }, [cachedTrace]);

  // Revert-to-formula: offered only when the AI diverged from the formula
  // (formulaBaseline present) and nothing has been logged yet — reverting
  // re-inits the prescription, so it must not clobber completed sets.
  const canRevertToFormula =
    traceEnabled &&
    cachedTrace?.formulaBaseline != null &&
    !actualSets.some((s) => s.is_completed);

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
  // Plate-derived smallest reachable increment — tracks equipmentDisabledPlates
  // so failure-adaptation reductions round to a weight the lifter can actually
  // load on the bar (GH#219).
  const weightIncrementKgRef = useRef<number | undefined>(undefined);
  weightIncrementKgRef.current = plateIncrementKg(equipmentDisabledPlates);

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
    plannedSetsLengthRef,
    oneRmKgRef,
    biologicalSexRef,
    weightIncrementKgRef,
  });

  // Live-derive PostRestOverlay weight from store so it stays in sync with
  // weight autoregulation accepts that land while the rest timer is running.
  const postRestWeightKg = useSessionStore((s) =>
    selectPostRestWeight({
      postRestState: s.postRestQueue[0] ?? null,
      plannedSets: s.plannedSets,
      actualSets: s.actualSets,
      currentAdaptation: s.currentAdaptation,
    })
  );

  // ── Video recording during post-rest overlay ──────────────────────────────

  const {
    handleVideoRecorded,
    wrapLiftComplete,
    wrapLiftFailed,
    pendingVideoUri,
  } = usePostRestVideoCapture({
    sessionId: sessionId ?? '',
    lift: sessionMeta?.primary_lift ?? 'squat',
    postRestState,
  });

  const handleLiftCompleteWithVideo = wrapLiftComplete(handleLiftComplete);
  const handleLiftFailedWithVideo = wrapLiftFailed(handleLiftFailed);

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

  const {
    bootstrapped,
    warmupSets: warmupSetsState,
    adHocExercises,
    setAdHocExercises,
    setWarmupSets: setWarmupSetsState,
  } = useSessionBootstrap({
    sessionId,
    jitDataParam: jitData,
    isFreeForm,
    userId: user?.id,
    invalidateSessionCache,
    oneRmKgRef,
    restRecommendationsRef: restRecommendations,
    llmRestSuggestionRef: llmRestSuggestion,
  });

  const handleRevertToFormula = useCallback(() => {
    const baseline = cachedTrace?.formulaBaseline;
    if (!baseline || !sessionId || !cachedTrace) return;
    Alert.alert(
      'Use formula prescription?',
      'Replace the AI-adjusted sets with the standard formula prescription for this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert',
          onPress: () => {
            void (async () => {
              try {
                const revertedTrace: PrescriptionTrace = {
                  ...cachedTrace,
                  strategy: 'formula',
                  rationale: baseline.rationale,
                  formulaBaseline: undefined,
                };
                await revertSessionToFormula(sessionId, {
                  planned_sets: toJson(baseline.mainLiftSets),
                  jit_output_trace: toJson(revertedTrace),
                });
                // Swap the live prescription in place (no remount): main sets +
                // aux from the formula baseline, warmup regenerated from the
                // restored weight, and the trace so the explainer/banner update.
                const store = useSessionStore.getState();
                store.initSession(sessionId, baseline.mainLiftSets);
                const formulaAux = baseline.auxiliaryWork as AuxiliaryWork[];
                store.initAuxiliaryWork(formulaAux);
                // initSession does NOT reset auxiliarySets (the loggable aux
                // rows), so mirror the bootstrap and replace them too — called
                // unconditionally (even with an empty list) to clear the stale
                // LLM-prescribed rows. Without this the lifter would log against
                // the AI's auxiliaries despite reverting the plan.
                store.initAuxiliary(
                  formulaAux
                    .filter((a) => !a.skipped)
                    .map((a) => ({
                      exercise: a.exercise,
                      sets: a.sets,
                      exerciseType: a.exerciseType,
                    }))
                );
                store.setCachedPrescriptionTrace(revertedTrace);
                setWarmupSetsState(baseline.warmupSets);
                restRecommendations.current = baseline.restRecommendations;
              } catch (err) {
                captureException(err);
                Alert.alert(
                  'Revert failed',
                  'Could not revert to the formula prescription — please try again.'
                );
              }
            })();
          },
        },
      ]
    );
  }, [cachedTrace, sessionId, setWarmupSetsState, restRecommendations]);

  // ── Focus-managed timer interval ───────────────────────────────────────────

  const hasTimers = Object.keys(timers).length > 0;
  useFocusEffect(
    useCallback(() => {
      if (hasTimers) {
        tickTimer();
        completeExpiredTimers();
        tickIntervalRef.current = setInterval(() => {
          tickTimer();
          completeExpiredTimers();
        }, 1000);
      }

      return () => {
        if (tickIntervalRef.current !== null) {
          clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasTimers])
  );

  // ── Exercise suggestions ──────────────────────────────────────────────────

  const exerciseCatalog = useMemo(() => getAllExercises(), []);
  const [recentAuxNames, setRecentAuxNames] = useState<string[]>([]);
  useEffect(() => {
    getRecentAuxExerciseNames().then(setRecentAuxNames).catch(captureException);
  }, []);

  const alreadyInSession = useMemo(
    () => [...auxiliaryWork.map((aw) => aw.exercise), ...adHocExercises],
    [auxiliaryWork, adHocExercises]
  );

  const templateBlocks = useMemo(
    () => groupTemplateBlocks(auxiliarySets),
    [auxiliarySets]
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

  // Rehab Mode (GH#220): drives the pain-limited pill on the RPE picker.
  // Only fetched when the session has a primary lift (ad-hoc sessions skip).
  const sessionLift = (sessionMeta?.primary_lift as Lift | null) ?? null;
  const { data: activeRehabCapForSession } = useRehabCapForLift(
    sessionLift ?? 'squat'
  );
  const rehabApplies =
    sessionLift !== null &&
    activeRehabCapForSession != null &&
    activeRehabCapForSession.lift === sessionLift
      ? activeRehabCapForSession
      : null;
  // Default the pain-limited toggle to whatever the most recent main-lift
  // RPE was tagged as. Saves taps in the all-pain-limited case.
  const previousPainLimited = useMemo(() => {
    if (!rehabApplies) return false;
    const lastWithRpe = [...actualSets]
      .reverse()
      .find((s) => s.rpe_actual !== undefined);
    return lastWithRpe?.pain_limited === true;
  }, [actualSets, rehabApplies]);

  // ── Screen-local handlers ─────────────────────────────────────────────────

  function handleConfirmAddExercise(
    name: string,
    _muscles?: MuscleGroup[],
    customType?: ExerciseType
  ) {
    if (!adHocExercises.includes(name)) {
      setAdHocExercises((prev) => [...prev, name]);
      const resolvedType = customType ?? getExerciseType(name);
      const oneRmGrams =
        oneRmKgRef.current != null ? Math.round(oneRmKgRef.current * 1000) : 0;
      // Timed and bodyweight exercises don't carry a prescribed load; skip
      // the weight calculation so we don't fabricate a barbell weight for a
      // user-typed "Running" entry.
      const suggestedWeight =
        resolvedType === 'weighted' && oneRmGrams > 0
          ? computeSuggestedWeight(name, oneRmGrams, exerciseCatalog)
          : 0;
      addAdHocSet(name, suggestedWeight, resolvedType);
    }
    setAddExerciseVisible(false);
  }

  function handleAddAdHocSet(exercise: string) {
    // Pass no type so the store reuses the existing sets' stored exercise_type
    // (a user-typed "no extra load" custom keeps bodyweight, not catalog-default
    // weighted). Falls back to catalog only when no prior set carries a type.
    addAdHocSet(exercise, undefined, undefined);
  }

  function handleConfirmAddWorkout(template: WorkoutTemplateWithItems) {
    const oneRmGrams =
      oneRmKgRef.current != null ? Math.round(oneRmKgRef.current * 1000) : 0;
    const entries = expandTemplate(template, template.items, {
      computeWeightGrams: (exercise) =>
        oneRmGrams > 0
          ? computeSuggestedWeight(exercise, oneRmGrams, exerciseCatalog)
          : 0,
    });
    addTemplateBlock(entries);
    // Template blocks render via AuxTemplateBlock — intentionally not
    // merged into adHocExercises so we don't double-render them as
    // per-exercise cards.
    setAddWorkoutVisible(false);
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
            cleanupResetInterval();
            clearPostRestState();
            reset();
            try {
              await abandonSession(sessionId);
            } finally {
              invalidateSessionCache();
              router.replace('/(tabs)/today');
            }
          },
        },
      ]
    );
  }

  function handleComplete() {
    // Clear all running timers before navigating to complete screen
    for (const key of Object.keys(timers)) {
      closeTimer(key);
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

  // Name shown in the post-rest overlay: the pending aux exercise, else the
  // session's primary lift.
  let postRestExerciseName: string | undefined;
  if (postRestState?.pendingAuxExercise) {
    postRestExerciseName = formatExerciseName(postRestState.pendingAuxExercise);
  } else if (sessionMeta?.primary_lift) {
    postRestExerciseName = formatExerciseName(sessionMeta.primary_lift);
  }

  // LLM suggestion is only relevant for main set timers
  const activeLlmSuggestion =
    activeTimer?.pendingMainSetNumber !== null
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

  if (!bootstrapped) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center' }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

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
              <View style={styles.liftTitleRow}>
                <Text style={styles.liftTitle}>{liftHeader}</Text>
              </View>
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

            {/* Revert-to-formula: the AI cut this session below the formula
                baseline. Offered until the first set is logged. */}
            {canRevertToFormula && (
              <View style={styles.revertBanner}>
                <Text style={styles.revertBannerText}>
                  The AI coach reduced this session below the standard formula
                  prescription.
                </Text>
                <TouchableOpacity
                  style={styles.revertButton}
                  onPress={handleRevertToFormula}
                  activeOpacity={0.7}
                >
                  <Text style={styles.revertButtonText}>Revert to formula</Text>
                </TouchableOpacity>
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
                  weightKg={displayWeightKg}
                  reps={actualSet.reps_completed}
                  placeholderWeightKg={planned?.weight_kg}
                  placeholderReps={planned?.reps}
                  repsRange={planned?.reps_range}
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
                  prescriptionTrace={traceEnabled ? formattedTrace : undefined}
                  videoIconSlot={
                    <SetVideoIcon
                      sessionId={sessionId}
                      lift={sessionMeta?.primary_lift ?? ''}
                      setNumber={actualSet.set_number}
                      isCompleted={actualSet.is_completed}
                      weightGrams={actualSet.weight_grams}
                      reps={actualSet.reps_completed}
                      rpe={actualSet.rpe_actual}
                    />
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
                  <ExerciseName
                    name={aw.exercise}
                    nameStyle={styles.auxExerciseName}
                  />

                  {aw.anchor && aw.sets[0] && (
                    <AuxAnchorNote
                      anchor={aw.anchor}
                      prescribedWeightKg={aw.sets[0].weight_kg}
                      weightIncrementKg={weightIncrementKgRef.current ?? 2.5}
                      colors={colors}
                    />
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
                      const displayWeightKg =
                        !actualSet.is_completed && adaptedSet
                          ? adaptedSet.weight_kg
                          : weightGramsToKg(actualSet.weight_grams);
                      return (
                        <SetRow
                          key={`${aw.exercise}-${actualSet.set_number}`}
                          setNumber={actualSet.set_number}
                          weightKg={displayWeightKg}
                          reps={actualSet.reps_completed}
                          placeholderWeightKg={planned?.weight_kg}
                          placeholderReps={planned?.reps}
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
                      <ExerciseName
                        name={aw.exercise}
                        nameStyle={styles.auxExerciseName}
                      />
                      {aw.topUpReason && (
                        <Text style={styles.topUpReason}>{aw.topUpReason}</Text>
                      )}
                      {aw.anchor && aw.sets[0] && (
                        <AuxAnchorNote
                          anchor={aw.anchor}
                          prescribedWeightKg={aw.sets[0].weight_kg}
                          weightIncrementKg={
                            weightIncrementKgRef.current ?? 2.5
                          }
                          colors={colors}
                        />
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
                          const displayWeightKg =
                            !actualSet.is_completed && adaptedSet
                              ? adaptedSet.weight_kg
                              : weightGramsToKg(actualSet.weight_grams);
                          return (
                            <SetRow
                              key={`${aw.exercise}-${actualSet.set_number}`}
                              setNumber={actualSet.set_number}
                              weightKg={displayWeightKg}
                              reps={actualSet.reps_completed}
                              placeholderWeightKg={planned?.weight_kg}
                              placeholderReps={planned?.reps}
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
              const sets = auxiliarySets.filter(
                (s) =>
                  s.exercise === exercise && s.template_instance_id == null
              );
              if (sets.length === 0) return null;
              return (
                <View key={exercise} style={styles.auxExercise}>
                  <View style={styles.adHocExerciseHeader}>
                    <ExerciseName
                      name={exercise}
                      nameStyle={styles.auxExerciseName}
                    />
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
                          weightKg={weightGramsToKg(actualSet.weight_grams)}
                          reps={actualSet.reps_completed}
                          rpeValue={actualSet.rpe_actual}
                          isCompleted={actualSet.is_completed}
                          exerciseType={
                            actualSet.exercise_type ?? getExerciseType(exercise)
                          }
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

        {/* Template blocks (HIIT, EMOM, etc.) — rendered as interleaved round
            sequences rather than per-exercise groupings. */}
        {templateBlocks.map((block) => (
          <AuxTemplateBlock
            key={block.id}
            block={block.entries}
            auxiliarySets={auxiliarySets}
            onRemoveBlock={() => removeTemplateBlock(block.id)}
            onAuxSetUpdate={(exercise, setNumber, setsInExercise, data) =>
              handleAuxSetUpdate(-1, exercise, setNumber, setsInExercise, data)
            }
            onAuxRpePress={requestAuxRpe}
            barWeightKg={equipmentBarWeightKg}
            disabledPlates={equipmentDisabledPlates}
            onBarWeightChange={handleBarWeightChange}
            onDisabledPlatesChange={handleDisabledPlatesChange}
          />
        ))}

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

        {/* Add workout (template) button */}
        <TouchableOpacity
          style={styles.addExerciseButton}
          onPress={() => setAddWorkoutVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel="Add workout template"
          accessibilityRole="button"
        >
          <Text style={styles.addExerciseButtonText}>+ Add Workout</Text>
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

      {/* Add workout (template) modal */}
      <AddWorkoutTemplateModal
        visible={addWorkoutVisible}
        onConfirm={handleConfirmAddWorkout}
        onClose={() => setAddWorkoutVisible(false)}
      />

      {/* RPE picker (primary) + rest timer + post-rest overlay */}
      {(activeTimer !== null ||
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
              exerciseName={formatExerciseName(pendingAuxConfirmation.exercise)}
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
              // Rehab Mode (GH#220): show the pain-limited toggle only for
              // main-lift RPE when an active cap covers this lift. Default-on
              // when the previous set in this session was tagged pain-limited
              // (saves taps in the common all-rehab session).
              showPainLimitedToggle={
                pendingRpeSetNumber !== null && !!rehabApplies
              }
              defaultPainLimited={previousPainLimited}
            />
          )}
          {activeTimer !== null && (
            <View
              style={
                pendingRpeSetNumber !== null || pendingAuxRpe !== null
                  ? styles.overlaySpaced
                  : undefined
              }
            >
              {timerCount > 1 && (
                <BackgroundTimerBadge
                  backgroundTimers={backgroundTimerEntries}
                  onSwitch={switchActiveTimer}
                />
              )}
              <RestTimer
                durationSeconds={
                  activeTimer.durationSeconds ?? DEFAULT_MAIN_REST_SECONDS
                }
                elapsed={activeTimer.elapsed ?? 0}
                offset={activeTimer.offset ?? 0}
                onAdjust={adjustTimer}
                llmSuggestion={activeLlmSuggestion}
                onDone={handleTimerDone}
                intensityLabel={intensity}
                autoHideOnExpiry
                bonusSeconds={
                  activeTimer.pendingMainSetNumber !== null &&
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
                          activeTimer.pendingMainSetNumber ?? null,
                        plannedSets,
                        actualSets,
                        currentAdaptation,
                        pendingAuxExercise:
                          activeTimer.pendingAuxExercise ?? null,
                        pendingAuxSetNumber:
                          activeTimer.pendingAuxSetNumber ?? null,
                        auxiliaryWork,
                      })
                }
              />
            </View>
          )}
          {postRestState !== null && activeTimer === null && (
            <PostRestOverlay
              plannedReps={postRestState.plannedReps}
              plannedWeightKg={postRestWeightKg}
              nextSetNumber={postRestState.nextSetNumber}
              exerciseName={postRestExerciseName}
              onLiftComplete={handleLiftCompleteWithVideo}
              onLiftFailed={handleLiftFailedWithVideo}
              onReset15s={handlePostRestReset}
              resetCountdown={postRestState.resetSecondsRemaining}
              recordingSlot={
                <PostRestRecordButton
                  savedUri={pendingVideoUri}
                  onRecorded={handleVideoRecorded}
                />
              }
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
