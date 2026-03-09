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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@modules/auth';
import { getCurrentCycleContext } from '@modules/cycle-tracking';
import { getCyclePhaseModifier } from '@parakeet/training-engine';
import { runJITForSession } from '@modules/jit';
import {
  getLatestSorenessCheckin,
  getSession,
  recordSorenessCheckin,
} from '@modules/session';
import type { Lift } from '@parakeet/shared-types';
import type { CyclePhase, MuscleGroup, ReadinessLevel } from '@parakeet/training-engine';
import { captureException } from '@platform/utils/captureException';
import {
  LIFT_PRIMARY_SORENESS_MUSCLES,
  MUSCLE_GROUPS_ORDER,
  MUSCLE_LABELS_FULL,
  READINESS_LABELS,
} from '@shared/constants/training';
import { capitalize } from '@shared/utils/string';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackLink } from '../../../components/navigation/BackLink';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

// ── Constants ────────────────────────────────────────────────────────────────

const RATING_LEVELS = [1, 2, 3, 4, 5] as const;
const READINESS_LEVELS = [1, 2, 3] as const;
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    muscleLabel: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
      marginRight: 12,
    },
    ratingPills: {
      flexDirection: 'row',
      gap: 6,
    },
    pill: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillActive: {
      backgroundColor: colors.primary,
    },
    pillText: {
      fontSize: 15,
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
    readinessLabel: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
      marginRight: 12,
    },
    readinessPills: {
      flexDirection: 'row',
      gap: 6,
    },
    readinessPill: {
      paddingHorizontal: 12,
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

function MuscleRatingRow({ muscle, rating, onChange, styles }: MuscleRatingRowProps) {
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
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
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
  levels: typeof READINESS_LEVELS;
  labels: Record<number, string>;
  value: ReadinessLevel;
  onChange: (v: ReadinessLevel) => void;
  styles: ReturnType<typeof buildStyles>;
  colors: ColorScheme;
}

function ReadinessPillRow({ label, levels, labels, value, onChange, styles, colors }: ReadinessPillRowProps) {
  const levelColors: Record<number, string> = {
    1: colors.warning,
    2: colors.textSecondary,
    3: colors.success,
  };
  const levelBg: Record<number, string> = {
    1: colors.warningMuted,
    2: colors.bgMuted,
    3: colors.successMuted,
  };

  return (
    <View style={styles.readinessRow}>
      <Text style={styles.readinessLabel}>{label}</Text>
      <View style={styles.readinessPills}>
        {levels.map((level) => {
          const isActive = value === level;
          return (
            <TouchableOpacity
              key={level}
              style={[
                styles.readinessPill,
                { backgroundColor: isActive ? levelBg[level] : colors.bgMuted },
                isActive && { borderColor: levelColors[level], borderWidth: 1.5 },
              ]}
              onPress={() => onChange(level as ReadinessLevel)}
              activeOpacity={0.7}
            >
              <Text style={[styles.readinessPillText, isActive && { color: levelColors[level] }]}>
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
  const [otherSoreness, setOtherSoreness] = useState<Record<string, number>>({});
  const [musclesExpanded, setMusclesExpanded] = useState(false);
  const [sleepQuality, setSleepQuality] = useState<ReadinessLevel>(2);
  const [energyLevel, setEnergyLevel] = useState<ReadinessLevel>(2);
  const [cyclePhase, setCyclePhase] = useState<CyclePhase | null>(null);
  const [cyclePhaseRationale, setCyclePhaseRationale] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const autoGenerateTriggered = useRef(false);

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
      const [data, latest, expanded] = await Promise.all([
        getSession(sessionId),
        getLatestSorenessCheckin(user.id),
        AsyncStorage.getItem(MUSCLES_EXPANDED_KEY),
      ]);

      setSession(data);
      if (expanded === 'true') setMusclesExpanded(true);

      if (data?.primary_lift) {
        const muscles =
          LIFT_PRIMARY_SORENESS_MUSCLES[data.primary_lift as Lift] ?? [];
        const initialRatings: Record<string, number> = {};
        for (const muscle of muscles) {
          initialRatings[muscle] = (latest as Record<string, number>)?.[muscle] ?? 1;
        }
        setRatings(initialRatings);
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
      .catch(() => {
        // non-fatal
      });
  }, [user]);

  // ── Auto-generate ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAutoGenerate || !session || !user || autoGenerateTriggered.current) return;
    const expectedMuscles =
      LIFT_PRIMARY_SORENESS_MUSCLES[session.primary_lift as Lift] ?? [];
    if (expectedMuscles.length > 0 && Object.keys(ratings).length === 0) return;
    autoGenerateTriggered.current = true;
    void runJIT(ratings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoGenerate, session, user, ratings]);

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

  async function runJIT(ratingsToUse: Record<string, number>) {
    if (!session || !user) return;
    setGenerating(true);
    try {
      const jitOutput = await runJITForSession(
        session,
        user.id,
        ratingsToUse,
        sleepQuality,
        energyLevel,
        cyclePhase ?? undefined,
      );
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
    if (!session || !user) return;
    const allRatings = buildAllRatings();
    try {
      await recordSorenessCheckin({
        sessionId,
        userId: user.id,
        ratings: { ...allRatings, sleep_quality: sleepQuality, energy_level: energyLevel },
        skipped: false,
      });
    } catch (err) {
      captureException(err);
    }
    await runJIT(allRatings);
  }

  async function handleSkip() {
    if (!session || !user) return;
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

  const hasSevereSoreness = Object.values(ratings).some((r) => r === 5);
  const liftLabel = session
    ? `${capitalize(session.primary_lift!)} — ${capitalize(session.intensity_type!)}`
    : 'Loading...';

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
          <Text style={styles.expandChevron}>{musclesExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {musclesExpanded && otherMuscles.map((muscle) => (
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
          1=Fresh 2=Mild 3=Moderate 4=High 5=Severe
        </Text>

        {/* Sleep + Energy readiness */}
        <View style={styles.readinessSection}>
          <ReadinessPillRow
            label="Sleep"
            levels={READINESS_LEVELS}
            labels={READINESS_LABELS.sleep}
            value={sleepQuality}
            onChange={setSleepQuality}
            styles={styles}
            colors={colors}
          />
          <ReadinessPillRow
            label="Energy"
            levels={READINESS_LEVELS}
            labels={READINESS_LABELS.energy}
            value={energyLevel}
            onChange={setEnergyLevel}
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

