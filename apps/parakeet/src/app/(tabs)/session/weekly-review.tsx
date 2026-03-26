import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@modules/auth';
import {
  getWeeklyVolumeForReview,
  MISMATCH_DIRECTION_LABELS,
  saveWeeklyBodyReview,
} from '@modules/body-review';
import { addBodyweightEntry, getProfile } from '@modules/profile';
import { getMrvMevConfig, volumeBarColor } from '@modules/training-volume';
import type { MuscleGroup } from '@parakeet/shared-types';
import { MUSCLE_GROUPS } from '@parakeet/shared-types';
import {
  computePredictedFatigue,
  detectMismatches,
} from '@parakeet/training-engine';
import type {
  FatigueLevel,
  FatigueMismatch,
  MrvMevConfig,
  PredictedFatigue,
} from '@parakeet/training-engine';
import { captureException } from '@platform/utils/captureException';
import { MUSCLE_LABELS_FULL } from '@shared/constants/training';
import { capitalize } from '@shared/utils/string';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../../components/navigation/BackLink';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type FatigueRatings = Partial<Record<MuscleGroup, FatigueLevel>>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bgSurface },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBackSlot: { width: 100 },
    headerTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    scrollView: { flex: 1 },
    container: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 48,
    },
    prompt: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 22,
    },
    reviewRow: {
      marginBottom: 20,
    },
    reviewRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    reviewMuscleLabel: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    reviewPills: {
      flexDirection: 'row',
      gap: 4,
    },
    pill: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillActive: {
      backgroundColor: colors.primary,
    },
    pillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    pillTextActive: {
      color: colors.textInverse,
    },
    volumeBarTrack: {
      height: 4,
      borderRadius: 2,
      flexDirection: 'row',
      overflow: 'hidden',
      backgroundColor: colors.bgMuted,
    },
    volumeBarFill: {
      height: 4,
      borderRadius: 2,
    },
    volumeBarEmpty: {
      height: 4,
    },
    volumeBarLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 4,
    },
    legend: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'center',
      marginBottom: 24,
      marginTop: 4,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    notesInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      minHeight: 80,
      marginBottom: 24,
      backgroundColor: colors.bgSurface,
    },
    bwRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    bwInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.bgSurface,
      flex: 1,
    },
    bwUnit: {
      fontSize: 14,
      color: colors.textSecondary,
      marginLeft: 8,
    },
    warningCard: {
      backgroundColor: colors.warningMuted,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    warningText: {
      fontSize: 13,
      color: colors.warning,
      lineHeight: 18,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textInverse,
    },
    // Mismatch summary
    mismatchContainer: {
      padding: 24,
    },
    mismatchTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    mismatchSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 20,
      lineHeight: 20,
    },
    mismatchRow: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    mismatchMuscleName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    mismatchDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    mismatchNumbers: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    mismatchDirection: {
      fontSize: 13,
      fontWeight: '600',
    },
    mismatchSuggestion: {
      backgroundColor: colors.warningMuted,
      borderRadius: 10,
      padding: 14,
      marginTop: 16,
    },
    mismatchSuggestionText: {
      fontSize: 13,
      color: colors.warning,
      lineHeight: 18,
    },
    doneButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    doneButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textInverse,
    },
  });
}

// ── Sub-component: single muscle review row ───────────────────────────────────

interface MuscleReviewRowProps {
  muscle: MuscleGroup;
  rating: FatigueLevel;
  predicted: PredictedFatigue;
  onChange: (muscle: MuscleGroup, rating: FatigueLevel) => void;
  styles: ReturnType<typeof buildStyles>;
  colors: ColorScheme;
}

function MuscleReviewRow({
  muscle,
  rating,
  predicted,
  onChange,
  styles,
  colors,
}: MuscleReviewRowProps) {
  const label =
    MUSCLE_LABELS_FULL[muscle] ?? capitalize(muscle.replace(/_/g, ' '));
  const barPct = Math.min(1, predicted.volumePct);
  const barColor = volumeBarColor(predicted.volumePct, colors);
  const FATIGUE_LEVELS: FatigueLevel[] = [1, 2, 3, 4, 5];

  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewRowHeader}>
        <Text style={styles.reviewMuscleLabel}>{label}</Text>
        <View style={styles.reviewPills}>
          {FATIGUE_LEVELS.map((level) => {
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
      {/* Volume bar */}
      <View style={styles.volumeBarTrack}>
        <View
          style={[
            styles.volumeBarFill,
            { flex: barPct, backgroundColor: barColor },
          ]}
        />
        <View style={[styles.volumeBarEmpty, { flex: 1 - barPct }]} />
      </View>
      <Text style={styles.volumeBarLabel}>
        {Math.round(predicted.volumePct * 100)}% of MRV • Predicted:{' '}
        {predicted.predicted}
      </Text>
    </View>
  );
}

// ── Mismatch summary ─────────────────────────────────────────────────────────

interface MismatchSummaryProps {
  mismatches: FatigueMismatch[];
  onDone: () => void;
  styles: ReturnType<typeof buildStyles>;
  colors: ColorScheme;
}

function MismatchSummary({
  mismatches,
  onDone,
  styles,
  colors,
}: MismatchSummaryProps) {
  const hasAccumulating = mismatches.some(
    (m) => m.direction === 'accumulating_fatigue'
  );

  return (
    <View style={styles.mismatchContainer}>
      <Text style={styles.mismatchTitle}>Review Saved</Text>
      {mismatches.length > 0 ? (
        <>
          <Text style={styles.mismatchSubtitle}>
            {mismatches.length} muscle{mismatches.length > 1 ? 's' : ''} differ
            from prediction by ≥2 levels
          </Text>
          {mismatches.map((m) => {
            const label = MUSCLE_LABELS_FULL[m.muscle] ?? m.muscle;
            const dir = MISMATCH_DIRECTION_LABELS[m.direction] ?? m.direction;
            const dirColor =
              m.direction === 'accumulating_fatigue'
                ? colors.warning
                : colors.success;
            return (
              <View key={m.muscle} style={styles.mismatchRow}>
                <Text style={styles.mismatchMuscleName}>{label}</Text>
                <View style={styles.mismatchDetails}>
                  <Text style={styles.mismatchNumbers}>
                    Felt {m.felt} · Predicted {m.predicted}
                  </Text>
                  <Text style={[styles.mismatchDirection, { color: dirColor }]}>
                    {dir}
                  </Text>
                </View>
              </View>
            );
          })}
          {hasAccumulating && (
            <View style={styles.mismatchSuggestion}>
              <Text style={styles.mismatchSuggestionText}>
                Consider reducing MRV for accumulating muscles in Settings →
                Volume Config
              </Text>
            </View>
          )}
        </>
      ) : (
        <Text style={styles.mismatchSubtitle}>
          Your body matches what the system predicted. Well calibrated!
        </Text>
      )}
      <TouchableOpacity
        style={styles.doneButton}
        onPress={onDone}
        activeOpacity={0.8}
      >
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklyReviewScreen() {
  const { colors } = useTheme();
  const { programId, weekNumber: weekNumberParam } = useLocalSearchParams<{
    programId: string;
    weekNumber: string;
  }>();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const weekNumber = parseInt(weekNumberParam ?? '0', 10);
  const { user } = useAuth();

  const [mrvMevConfig, setMrvMevConfig] = useState<MrvMevConfig | null>(null);
  const [weeklyVolume, setWeeklyVolume] = useState<Record<
    MuscleGroup,
    number
  > | null>(null);
  const [predicted, setPredicted] = useState<Record<
    MuscleGroup,
    PredictedFatigue
  > | null>(null);
  const [ratings, setRatings] = useState<FatigueRatings>({});
  const [notes, setNotes] = useState('');
  const [bodyweightKg, setBodyweightKg] = useState('');
  const [saving, setSaving] = useState(false);
  const [mismatches, setMismatches] = useState<FatigueMismatch[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      try {
        const [config, volume, profile] = await Promise.all([
          getMrvMevConfig(user.id),
          programId
            ? getWeeklyVolumeForReview(user.id, programId, weekNumber)
            : Promise.resolve(null),
          getProfile(),
        ]);

        if (profile?.bodyweight_kg != null) {
          setBodyweightKg(profile.bodyweight_kg.toString());
        }

        setMrvMevConfig(config);
        const resolvedVolume =
          volume ??
          (Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0])) as Record<
            MuscleGroup,
            number
          >);
        setWeeklyVolume(resolvedVolume);

        const predictedFatigue = computePredictedFatigue(
          resolvedVolume,
          config
        );
        setPredicted(predictedFatigue);
        const initial: FatigueRatings = {};
        for (const muscle of MUSCLE_GROUPS) {
          initial[muscle] = predictedFatigue[muscle].predicted;
        }
        setRatings(initial);
      } catch (err) {
        captureException(err);
        setLoadError('Could not load review data. Please try again.');
      }
    })();
  }, [user, programId, weekNumber]);

  function handleRatingChange(muscle: MuscleGroup, level: FatigueLevel) {
    setRatings((prev) => ({ ...prev, [muscle]: level }));
  }

  async function handleSave() {
    if (!user || !mrvMevConfig || !predicted || !weeklyVolume) return;
    setSaving(true);
    try {
      const detected = detectMismatches(ratings, predicted);
      await saveWeeklyBodyReview({
        userId: user.id,
        programId: programId || null,
        weekNumber,
        feltSoreness: ratings,
        weeklyVolume,
        mrvMevConfig,
        notes: notes.trim() || null,
      });
      // Record bodyweight if entered
      const parsedBw = bodyweightKg.trim() ? parseFloat(bodyweightKg) : null;
      if (parsedBw != null && !isNaN(parsedBw) && parsedBw > 0) {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        await addBodyweightEntry({ recordedDate: today, weightKg: parsedBw });
      }

      setMismatches(detected);
    } catch (err) {
      captureException(err);
      Alert.alert('Error', 'Could not save review — please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (mismatches !== null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <MismatchSummary
            mismatches={mismatches}
            onDone={() => router.replace('/(tabs)/today')}
            styles={styles}
            colors={colors}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const title =
    weekNumber > 0 ? `Week ${weekNumber} Body Review` : 'Body Review';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerBackSlot}>
          <BackLink onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerBackSlot} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {loadError && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>{loadError}</Text>
          </View>
        )}

        <Text style={styles.prompt}>
          Rate how each muscle actually feels. The bars show the last 7 days of
          training volume vs MRV.
        </Text>

        {predicted &&
          MUSCLE_GROUPS.map((muscle) => (
            <MuscleReviewRow
              key={muscle}
              muscle={muscle}
              rating={(ratings[muscle] ?? 1) as FatigueLevel}
              predicted={predicted[muscle]}
              onChange={handleRatingChange}
              styles={styles}
              colors={colors}
            />
          ))}

        <Text style={styles.legend}>
          1=Fresh 2=Mild 3=Moderate 4=High 5=Severe
        </Text>

        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Any patterns or observations..."
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={styles.sectionLabel}>Bodyweight (optional)</Text>
        <View style={styles.bwRow}>
          <TextInput
            style={styles.bwInput}
            placeholder="e.g. 82.5"
            placeholderTextColor={colors.textTertiary}
            value={bodyweightKg}
            onChangeText={setBodyweightKg}
            keyboardType="decimal-pad"
          />
          <Text style={styles.bwUnit}>kg</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || !predicted || !weeklyVolume}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Review'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
