import { useEffect, useRef, useState } from 'react';
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
import { runJITForSession } from '@modules/jit';
import {
  getLatestSorenessCheckin,
  getSession,
  recordSorenessCheckin,
} from '@modules/session';
import type { Lift } from '@parakeet/shared-types';
import type { MuscleGroup } from '@parakeet/training-engine';
import { captureException } from '@platform/utils/captureException';
import {
  LIFT_PRIMARY_SORENESS_MUSCLES,
  MUSCLE_LABELS_FULL,
} from '@shared/constants/training';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackLink } from '../../../components/navigation/BackLink';
import { colors } from '../../../theme';

// ── Types ────────────────────────────────────────────────────────────────────

type Session = Awaited<ReturnType<typeof getSession>>;

// ── Constants ────────────────────────────────────────────────────────────────

const RATING_LEVELS = [1, 2, 3, 4, 5] as const;

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ── Sub-component: single muscle rating row ───────────────────────────────

interface MuscleRatingRowProps {
  muscle: MuscleGroup;
  rating: number;
  onChange: (muscle: MuscleGroup, rating: number) => void;
}

function MuscleRatingRow({ muscle, rating, onChange }: MuscleRatingRowProps) {
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

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SorenessScreen() {
  const { sessionId, autoGenerate } = useLocalSearchParams<{
    sessionId: string;
    autoGenerate?: string;
  }>();
  const { user } = useAuth();

  const isAutoGenerate = autoGenerate === '1';

  const [session, setSession] = useState<Session>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState(false);
  const autoGenerateTriggered = useRef(false);

  const muscles = session
    ? (LIFT_PRIMARY_SORENESS_MUSCLES[session.primary_lift as Lift] ?? [])
    : [];

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId || !user) return;
    Promise.all([
      getSession(sessionId),
      getLatestSorenessCheckin(user.id),
    ]).then(([data, latest]) => {
      setSession(data);
      if (data?.primary_lift) {
        const muscles =
          LIFT_PRIMARY_SORENESS_MUSCLES[data.primary_lift as Lift] ?? [];
        const initialRatings: Record<string, number> = {};
        for (const muscle of muscles) {
          initialRatings[muscle] = latest?.[muscle] ?? 1;
        }
        setRatings(initialRatings);
      }
    });
  }, [sessionId, user]);

  // ── Auto-generate: skip form and re-run JIT when resuming in-progress session ──

  useEffect(() => {
    if (!isAutoGenerate || !session || !user || autoGenerateTriggered.current)
      return;
    // Wait for ratings to be populated (bootstrap sets them after session loads)
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

  function allFreshRatings(): Record<string, number> {
    const fresh: Record<string, number> = {};
    for (const muscle of muscles) {
      fresh[muscle] = 1;
    }
    return fresh;
  }

  async function runJIT(ratingsToUse: Record<string, number>) {
    if (!session || !user) return;
    setGenerating(true);
    try {
      const jitOutput = await runJITForSession(session, user.id, ratingsToUse);
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
    try {
      await recordSorenessCheckin({
        sessionId,
        userId: user.id,
        ratings,
        skipped: false,
      });
    } catch (err) {
      captureException(err);
    }
    await runJIT(ratings);
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
    ? `${capitalize(session.primary_lift)} — ${capitalize(session.intensity_type)}`
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

        {/* Muscle rating rows */}
        {muscles.map((muscle) => (
          <MuscleRatingRow
            key={muscle}
            muscle={muscle}
            rating={ratings[muscle] ?? 1}
            onChange={handleRatingChange}
          />
        ))}

        {/* Rating legend */}
        <Text style={styles.legend}>
          1=Fresh 2=Mild 3=Moderate 4=High 5=Severe
        </Text>

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

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
    marginBottom: 24,
    textAlign: 'center',
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
