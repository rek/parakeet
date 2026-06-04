import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@modules/auth';
import {
  getCurrentCycleContext,
  getCyclePhaseModifier,
} from '@modules/cycle-tracking';
import type { CyclePhase } from '@modules/cycle-tracking';
import { getActiveDisruptions } from '@modules/disruptions';
import { runJITForSession } from '@modules/jit';
import type { ReadinessLevel } from '@modules/jit';
import { getCurrentOneRmKg } from '@modules/program';
import {
  getLatestSorenessCheckin,
  getReadinessPillColors,
  getSession,
  getSorenessCheckinForSession,
  recordSorenessCheckin,
  useSessionStore,
} from '@modules/session';
import {
  mapAutonomicToLevel,
  mapSleepDurationToLevel,
  useEnsureFreshSnapshot,
  useRecoverySnapshot,
} from '@modules/wearable';
import type { Lift, MuscleGroup } from '@parakeet/shared-types';
import { captureException } from '@platform/utils/captureException';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LIFT_PRIMARY_SORENESS_MUSCLES,
  MUSCLE_GROUPS_ORDER,
  MUSCLE_LABELS_FULL,
  READINESS_LABELS,
} from '@shared/constants/training';
import { capitalize, sessionLabel } from '@shared/utils/string';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../../components/navigation/BackLink';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

// ── Constants ────────────────────────────────────────────────────────────────

const RATING_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const READINESS_LEVELS = [1, 2, 3, 4, 5] as const;
const MUSCLES_EXPANDED_KEY = 'readiness_muscles_expanded';

// ── Styles builder ────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bgSurface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBackSlot: {
      width: 116,
      alignItems: 'flex-start',
    },
    headerTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginHorizontal: 8,
    },
    headerSkip: {
      width: 116,
      alignItems: 'flex-end',
    },
    headerSkipText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '500',
    },
    scrollView: {
      flex: 1,
    },
    container: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 48,
    },
    prompt: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 24,
    },
    muscleRow: {
      marginBottom: 16,
    },
    muscleLabel: {
      fontSize: 15,
      color: colors.text,
      marginBottom: 6,
    },
    ratingPills: {
      flexDirection: 'row',
      gap: 3,
    },
    pill: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillActive: {
      backgroundColor: colors.primary,
    },
    pillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    pillTextActive: {
      color: colors.textInverse,
    },
    legend: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 8,
      marginBottom: 8,
      textAlign: 'center',
    },
    expandHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 4,
    },
    expandHeaderText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    expandChevron: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    readinessSection: {
      marginTop: 8,
      marginBottom: 16,
      gap: 12,
    },
    readinessRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    readinessLabelColumn: {
      flex: 1,
      marginRight: 12,
    },
    readinessLabel: {
      fontSize: 15,
      color: colors.text,
    },
    readinessHint: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    readinessPills: {
      flexDirection: 'row',
      gap: 4,
      flexWrap: 'wrap',
    },
    readinessPill: {
      paddingHorizontal: 10,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    readinessPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    cycleChip: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginBottom: 16,
    },
    cycleChipText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '500',
    },
    infoCard: {
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 20,
    },
    infoText: {
      fontSize: 14,
      color: colors.primary,
      lineHeight: 20,
    },
    warningCard: {
      backgroundColor: colors.warningMuted,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 24,
    },
    warningText: {
      fontSize: 14,
      color: colors.warning,
      lineHeight: 20,
    },
    generateButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    generateButtonDisabled: {
      opacity: 0.4,
    },
    generateButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textInverse,
    },
    generatingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlayLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    generatingCard: {
      backgroundColor: colors.bgSurface,
      borderRadius: 16,
      paddingVertical: 32,
      paddingHorizontal: 40,
      alignItems: 'center',
      gap: 16,
    },
    generatingText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface MuscleRatingRowProps {
  muscle: MuscleGroup;
  rating: number;
  onChange: (muscle: MuscleGroup, rating: number) => void;
  styles: ReturnType<typeof buildStyles>;
}

function MuscleRatingRow({
  muscle,
  rating,
  onChange,
  styles,
}: MuscleRatingRowProps) {
  const label =
    MUSCLE_LABELS_FULL[muscle] ?? capitalize(muscle.replace(/_/g, ' '));

  return (
    <View style={styles.muscleRow}>
      <Text style={styles.muscleLabel}>{label}</Text>
      <View style={styles.ratingPills}>
        {RATING_LEVELS.map((level) => {
          const isActive = rating === level;
          return (
            <TouchableOpacity
              key={level}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => onChange(muscle, level)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.pillText, isActive && styles.pillTextActive]}
              >
                {level}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

interface ReadinessPillRowProps {
  label: string;
  hint?: string;
  levels: typeof READINESS_LEVELS;
  labels: Record<number, string>;
  value: ReadinessLevel;
  onChange: (v: ReadinessLevel) => void;
  styles: ReturnType<typeof buildStyles>;
  colors: ColorScheme;
}

function ReadinessPillRow({
  label,
  hint,
  levels,
  labels,
  value,
  onChange,
  styles,
  colors,
}: ReadinessPillRowProps) {
  const pillColors = getReadinessPillColors(colors);

  return (
    <View style={styles.readinessRow}>
      <View style={styles.readinessLabelColumn}>
        <Text style={styles.readinessLabel}>{label}</Text>
        {hint && <Text style={styles.readinessHint}>{hint}</Text>}
      </View>
      <View style={styles.readinessPills}>
        {levels.map((level) => {
          const isActive = value === level;
          return (
            <TouchableOpacity
              key={level}
              style={[
                styles.readinessPill,
                {
                  backgroundColor: isActive
                    ? pillColors.bg[level]
                    : colors.bgMuted,
                },
                isActive && {
                  borderColor: pillColors.text[level],
                  borderWidth: 1.5,
                },
              ]}
              onPress={() => onChange(level as ReadinessLevel)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.readinessPillText,
                  isActive && { color: pillColors.text[level] },
                ]}
              >
                {labels[level]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

type Session = Awaited<ReturnType<typeof getSession>>;

export default function SorenessScreen() {
  const { colors } = useTheme();
  const { sessionId, autoGenerate } = useLocalSearchParams<{
    sessionId: string;
    autoGenerate?: string;
  }>();
  const { user } = useAuth();

  const styles = useMemo(() => buildStyles(colors), [colors]);
  const isAutoGenerate = autoGenerate === '1';

  const [session, setSession] = useState<Session>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [otherSoreness, setOtherSoreness] = useState<Record<string, number>>(
    {}
  );
  const [musclesExpanded, setMusclesExpanded] = useState(false);
  // Default to the 1–5 scale neutral midpoint (3 = "OK"). Engine treats 3 as
  // no-change; using 2 would surface a "Low energy" rationale before the user
  // ever taps a pill. UI labels: `READINESS_LABELS` in shared/constants/training.
  const [sleepQuality, setSleepQuality] = useState<ReadinessLevel>(3);
  const [energyLevel, setEnergyLevel] = useState<ReadinessLevel>(3);
  const [sleepTouched, setSleepTouched] = useState(false);
  const [energyTouched, setEnergyTouched] = useState(false);
  const [sleepFromWearable, setSleepFromWearable] = useState(false);
  const [energyFromWearable, setEnergyFromWearable] = useState(false);
  const [cyclePhase, setCyclePhase] = useState<CyclePhase | null>(null);
  const [cyclePhaseRationale, setCyclePhaseRationale] = useState<string | null>(
    null
  );
  const [generating, setGenerating] = useState(false);
  const [activeDisruptionDescs, setActiveDisruptionDescs] = useState<string[]>(
    []
  );
  const autoGenerateTriggered = useRef(false);

  // Pre-checkin sync gate: actively sync Health Connect on mount (bounded by
  // an 8s timeout) and invalidate the snapshot query so prefill reads current
  // data. `syncResolved` flips true once sync settles (success/skip/timeout)
  // so auto-generate doesn't fire on a stale snapshot.
  const { resolved: syncResolved } = useEnsureFreshSnapshot();
  const { data: recoverySnapshot, isPending: recoveryQueryPending } =
    useRecoverySnapshot();

  const primaryMuscles: readonly MuscleGroup[] = session
    ? (LIFT_PRIMARY_SORENESS_MUSCLES[session.primary_lift as Lift] ?? [])
    : [];

  const otherMuscles: MuscleGroup[] = MUSCLE_GROUPS_ORDER.filter(
    (m) => !(primaryMuscles as readonly string[]).includes(m)
  ) as MuscleGroup[];

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId || !user) return;

    void (async () => {
      try {
        const [data, latest, sessionCheckin, expanded, disruptions] =
          await Promise.all([
            getSession(sessionId),
            getLatestSorenessCheckin(user.id),
            getSorenessCheckinForSession(sessionId),
            AsyncStorage.getItem(MUSCLES_EXPANDED_KEY),
            getActiveDisruptions(user.id),
          ]);

        if (!data) {
          // Surface clearly rather than silently rendering an empty form.
          Alert.alert(
            'Session not found',
            'This workout no longer exists. Returning to Today.',
            [
              {
                text: 'Open Today',
                onPress: () => router.replace('/(tabs)/today'),
              },
            ]
          );
          return;
        }

        setSession(data);
        if (expanded === 'true') setMusclesExpanded(true);
        const descs = disruptions
          .filter((d) => d.description)
          .map((d) => d.description as string);
        setActiveDisruptionDescs(descs);

        // Re-seed readiness from a prior check-in for THIS session so a value
        // the lifter already entered survives regeneration. Marking them
        // touched stops the wearable prefill effect (and the skip/auto-generate
        // resolve path) from silently overwriting them with an unconfirmed
        // autonomic reading. Without this, a lifter who entered energy 3 then
        // re-entered/skipped got the wearable's energy 1 fed to JIT.
        if (sessionCheckin) {
          const priorEnergy = sessionCheckin.energy_level;
          const priorSleep = sessionCheckin.sleep_quality;
          if (
            typeof priorEnergy === 'number' &&
            priorEnergy >= 1 &&
            priorEnergy <= 5
          ) {
            setEnergyLevel(priorEnergy as ReadinessLevel);
            setEnergyTouched(true);
          }
          if (
            typeof priorSleep === 'number' &&
            priorSleep >= 1 &&
            priorSleep <= 5
          ) {
            setSleepQuality(priorSleep as ReadinessLevel);
            setSleepTouched(true);
          }
        }

        if (data.primary_lift) {
          const muscles =
            LIFT_PRIMARY_SORENESS_MUSCLES[data.primary_lift as Lift] ?? [];
          const initialRatings: Record<string, number> = {};
          for (const muscle of muscles) {
            initialRatings[muscle] =
              (latest as Record<string, number>)?.[muscle] ?? 1;
          }
          setRatings(initialRatings);
        }
      } catch (err) {
        captureException(err);
        Alert.alert(
          'Could not load session',
          'Something went wrong loading this workout.',
          [
            {
              text: 'Open Today',
              onPress: () => router.replace('/(tabs)/today'),
            },
          ]
        );
      }
    })();
  }, [sessionId, user]);

  // Fetch cycle context for female users
  useEffect(() => {
    if (!user) return;
    void getCurrentCycleContext(user.id)
      .then((ctx) => {
        if (!ctx) return;
        setCyclePhase(ctx.phase);
        const modifier = getCyclePhaseModifier(ctx.phase);
        setCyclePhaseRationale(modifier.rationale);
      })
      .catch((err) => captureException(err));
  }, [user]);

  // Prefill sleep + energy pills from wearable snapshot. Only seeds untouched
  // pills — once the user taps a pill, manual value wins.
  useEffect(() => {
    if (!recoverySnapshot) return;

    if (!sleepTouched) {
      const mapped = mapSleepDurationToLevel(
        recoverySnapshot.sleep_duration_min
      );
      if (mapped !== null) {
        setSleepQuality(mapped);
        setSleepFromWearable(true);
      }
    }

    if (!energyTouched) {
      const mapped = mapAutonomicToLevel(
        recoverySnapshot.hrv_pct_change,
        recoverySnapshot.rhr_pct_change
      );
      if (mapped !== null) {
        setEnergyLevel(mapped);
        setEnergyFromWearable(true);
      }
    }
  }, [recoverySnapshot, sleepTouched, energyTouched]);

  // ── Auto-generate ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAutoGenerate || !session || !user || autoGenerateTriggered.current)
      return;
    // Wait until BOTH the pre-checkin sync settled and the snapshot query
    // resolved. Without the sync gate, JIT could read yesterday's snapshot.
    if (!syncResolved || recoveryQueryPending) return;
    const expectedMuscles =
      LIFT_PRIMARY_SORENESS_MUSCLES[session.primary_lift as Lift] ?? [];
    if (expectedMuscles.length > 0 && Object.keys(ratings).length === 0) return;

    // Compute resolved readiness values inline. State updates queued by the
    // prefill effect in this same commit do NOT show up in `sleepQuality` /
    // `energyLevel` until the next render — passing those state values to
    // runJIT would race against the prefill (GH#210).
    //
    // TODO(bundle-followup): extract this readiness resolution into a pure
    // function `modules/jit/application/resolveReadiness.ts`. The same
    // resolution logic is duplicated in the autogenerate effect and the
    // manual generate path below — pulling it into a single module-side
    // function would keep this screen thin and let us unit-test the
    // wearable-vs-touched precedence in isolation. Deferred per direction.
    const resolvedSleep = sleepTouched
      ? sleepQuality
      : (recoverySnapshot
          ? mapSleepDurationToLevel(recoverySnapshot.sleep_duration_min)
          : null) ?? sleepQuality;
    const resolvedEnergy = energyTouched
      ? energyLevel
      : (recoverySnapshot
          ? mapAutonomicToLevel(
              recoverySnapshot.hrv_pct_change,
              recoverySnapshot.rhr_pct_change
            )
          : null) ?? energyLevel;

    autoGenerateTriggered.current = true;
    setGenerating(true);
    void runJIT(ratings, { sleep: resolvedSleep, energy: resolvedEnergy });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAutoGenerate,
    session,
    user,
    ratings,
    syncResolved,
    recoveryQueryPending,
    recoverySnapshot,
  ]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function handleRatingChange(muscle: MuscleGroup, rating: number) {
    setRatings((prev) => ({ ...prev, [muscle]: rating }));
  }

  function handleOtherRatingChange(muscle: MuscleGroup, rating: number) {
    setOtherSoreness((prev) => ({ ...prev, [muscle]: rating }));
  }

  async function toggleMusclesExpanded() {
    const next = !musclesExpanded;
    setMusclesExpanded(next);
    await AsyncStorage.setItem(MUSCLES_EXPANDED_KEY, String(next));
  }

  function buildAllRatings(): Record<string, number> {
    return { ...otherSoreness, ...ratings };
  }

  function allFreshRatings(): Record<string, number> {
    const fresh: Record<string, number> = {};
    for (const muscle of primaryMuscles) {
      fresh[muscle] = 1;
    }
    return fresh;
  }

  /**
   * When the session already had JIT generated AND there's an active
   * disruption that affects this lift, regenerating JIT would discard the
   * disruption-adjusted prescription. Bundle B composes disruption into the
   * JIT input on the engine side; here we just ask the lifter first.
   */
  async function shouldConfirmDisruptionOverwrite(): Promise<boolean> {
    if (!session || !user) return false;
    if (!session.jit_generated_at) return false;
    try {
      const active = await getActiveDisruptions(user.id);
      const lift = session.primary_lift;
      const affectsThisSession = active.some((d) => {
        const lifts = (d.affected_lifts ?? []) as readonly string[];
        return lifts.length === 0 || (lift != null && lifts.includes(lift));
      });
      return affectsThisSession;
    } catch (err) {
      captureException(err);
      return false;
    }
  }

  async function runJIT(
    ratingsToUse: Record<string, number>,
    readinessOverride?: { sleep: ReadinessLevel; energy: ReadinessLevel }
  ) {
    if (!session || !user) return;
    // Prompt before discarding a disruption-adjusted prescription.
    const needsConfirm = await shouldConfirmDisruptionOverwrite();
    if (needsConfirm) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Regenerate prescription?',
          'This session may have a disruption-adjusted prescription. Regenerate?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Regenerate', onPress: () => resolve(true) },
          ],
          { onDismiss: () => resolve(false) }
        );
      });
      if (!proceed) {
        setGenerating(false);
        return;
      }
    }
    try {
      const primaryLift = session.primary_lift as Lift | null;
      // Override path is used by auto-generate to avoid the same-commit race
      // where prefill state updates haven't applied yet (GH#210).
      const sleepForJit = readinessOverride?.sleep ?? sleepQuality;
      const energyForJit = readinessOverride?.energy ?? energyLevel;
      const [jitResult, fetchedOneRmKg] = await Promise.all([
        runJITForSession(
          session,
          user.id,
          ratingsToUse,
          sleepForJit,
          energyForJit,
          cyclePhase ?? undefined
        ),
        primaryLift
          ? getCurrentOneRmKg(user.id, primaryLift)
          : Promise.resolve(null),
      ]);
      const jitOutput = jitResult.output;
      // Store prescription trace in Zustand (too large for route params)
      useSessionStore.getState().setCachedPrescriptionTrace(jitResult.trace);
      // Surface LLM fallback to user — they'd otherwise see formula sets with no explanation
      if (jitOutput.jit_strategy === 'formula_fallback') {
        Alert.alert(
          'AI coaching unavailable',
          'Could not reach the AI model — your session is using the standard formula prescription instead.'
        );
      }
      router.replace({
        pathname: '/session/[sessionId]',
        params: {
          sessionId: session.id,
          jitData: JSON.stringify({
            mainLiftSets: jitOutput.mainLiftSets,
            warmupSets: jitOutput.warmupSets,
            auxiliaryWork: jitOutput.auxiliaryWork,
            restRecommendations: jitOutput.restRecommendations,
            llmRestSuggestion: jitOutput.llmRestSuggestion ?? null,
            oneRmKg: fetchedOneRmKg ?? undefined,
            volumeReductions: jitOutput.volumeReductions,
            rationale: jitOutput.rationale,
            intensityModifier: jitOutput.intensityModifier,
            jit_strategy: jitOutput.jit_strategy,
          }),
        },
      });
    } catch (err: unknown) {
      captureException(err);
      Alert.alert(
        'Generation failed',
        err instanceof Error
          ? err.message
          : 'Unable to generate workout — try again.'
      );
      setGenerating(false);
    }
  }

  async function handleGenerate() {
    if (!session || !user || generating) return;
    setGenerating(true);
    const allRatings = buildAllRatings();
    try {
      await recordSorenessCheckin({
        sessionId,
        userId: user.id,
        ratings: {
          ...allRatings,
          sleep_quality: sleepQuality,
          energy_level: energyLevel,
        },
        skipped: false,
      });
    } catch (err) {
      captureException(err);
    }
    await runJIT(allRatings);
  }

  async function handleSkip() {
    if (!session || !user || generating) return;
    setGenerating(true);
    const freshRatings = allFreshRatings();
    setRatings(freshRatings);
    try {
      await recordSorenessCheckin({
        sessionId,
        userId: user.id,
        ratings: freshRatings,
        skipped: true,
      });
    } catch (err) {
      captureException(err);
    }
    await runJIT(freshRatings);
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasSevereSoreness = [...Object.values(ratings), ...Object.values(otherSoreness)].some((r) => r >= 9);
  const liftLabel = session ? sessionLabel(session) : 'Loading...';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Custom header */}
      <View style={styles.header}>
        <View style={styles.headerBackSlot}>
          <BackLink onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {liftLabel}
        </Text>
        <TouchableOpacity
          onPress={handleSkip}
          activeOpacity={0.7}
          style={styles.headerSkip}
          disabled={generating}
        >
          <Text style={styles.headerSkipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.prompt}>How are these muscles feeling today?</Text>

        {/* Active disruption context banner */}
        {activeDisruptionDescs.length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              You reported: {activeDisruptionDescs[0]}. Your soreness may be
              from this activity.
            </Text>
          </View>
        )}

        {/* Primary muscle rating rows */}
        {primaryMuscles.map((muscle) => (
          <MuscleRatingRow
            key={muscle}
            muscle={muscle}
            rating={ratings[muscle] ?? 1}
            onChange={handleRatingChange}
            styles={styles}
          />
        ))}

        {/* Other muscles — collapsible */}
        <TouchableOpacity
          style={styles.expandHeader}
          onPress={toggleMusclesExpanded}
          activeOpacity={0.7}
        >
          <Text style={styles.expandHeaderText}>Other muscles</Text>
          <Text style={styles.expandChevron}>
            {musclesExpanded ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {musclesExpanded &&
          otherMuscles.map((muscle) => (
            <MuscleRatingRow
              key={muscle}
              muscle={muscle}
              rating={otherSoreness[muscle] ?? 1}
              onChange={handleOtherRatingChange}
              styles={styles}
            />
          ))}

        {/* Rating legend */}
        <Text style={styles.legend}>
          1–4 Fresh · 5–6 Moderate · 7–8 High · 9–10 Severe
        </Text>

        {/* Sleep + energy pills — prefilled from wearable when available */}
        <View style={styles.readinessSection}>
          <ReadinessPillRow
            label="Sleep"
            hint={
              sleepFromWearable && !sleepTouched ? 'from wearable' : undefined
            }
            levels={READINESS_LEVELS}
            labels={READINESS_LABELS.sleep}
            value={sleepQuality}
            onChange={(v) => {
              setSleepQuality(v);
              setSleepTouched(true);
            }}
            styles={styles}
            colors={colors}
          />
          <ReadinessPillRow
            label="Energy"
            hint={
              energyFromWearable && !energyTouched ? 'from wearable' : undefined
            }
            levels={READINESS_LEVELS}
            labels={READINESS_LABELS.energy}
            value={energyLevel}
            onChange={(v) => {
              setEnergyLevel(v);
              setEnergyTouched(true);
            }}
            styles={styles}
            colors={colors}
          />
        </View>

        {/* Cycle phase informational chip */}
        {cyclePhase && cyclePhaseRationale && (
          <View style={styles.cycleChip}>
            <Text style={styles.cycleChipText}>{cyclePhaseRationale}</Text>
          </View>
        )}

        {/* Severe soreness warning */}
        {hasSevereSoreness && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              Severe soreness detected — recovery session at 40% intensity
            </Text>
          </View>
        )}

        {/* Generate button */}
        <TouchableOpacity
          style={[
            styles.generateButton,
            (!session || generating) && styles.generateButtonDisabled,
          ]}
          onPress={handleGenerate}
          disabled={!session || generating}
          activeOpacity={0.8}
        >
          <Text style={styles.generateButtonText}>
            Generate Today's Workout →
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Generating overlay */}
      {generating && (
        <View style={styles.generatingOverlay}>
          <View style={styles.generatingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.generatingText}>
              Generating your workout...
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
