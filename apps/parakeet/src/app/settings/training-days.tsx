import { useEffect, useMemo, useState } from 'react';
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
  countFuturePlannedSessions,
  updateTrainingDays,
  useActiveProgram,
} from '@modules/program';
import { DEFAULT_TRAINING_DAYS } from '@parakeet/training-engine';
import { qk } from '@platform/query';
import { captureException } from '@platform/utils/captureException';
import { DAY_LABELS } from '@shared/constants';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ColorScheme } from '../../theme';
import { radii, spacing, typography } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import { BackLink } from '../../components/navigation/BackLink';
import { ScreenTitle } from '../../components/ui/ScreenTitle';

// ── Helpers ───────────────────────────────────────────────────────────────────

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

// ── Styles ────────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[6],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
    },
    titleWrap: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[6],
    },
    subtitle: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    saveBtn: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    saveBtnDisabled: {
      opacity: 0.4,
    },
    saveBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
      color: colors.textInverse,
    },
    sectionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.widest,
      paddingHorizontal: spacing[6],
      marginBottom: spacing[3],
    },
    dayRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing[6],
      gap: spacing[2],
      marginBottom: spacing[2],
      flexWrap: 'wrap',
    },
    dayChip: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: radii.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.bgSurface,
    },
    dayChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    dayChipText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    dayChipTextActive: {
      color: colors.primary,
    },
    hint: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      paddingHorizontal: spacing[6],
      marginBottom: spacing[4],
    },
    infoCard: {
      marginHorizontal: spacing[6],
      marginTop: spacing[4],
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing[4],
    },
    infoText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    emptyWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing[8],
    },
    emptyText: {
      fontSize: typography.sizes.base,
      color: colors.textTertiary,
      textAlign: 'center',
    },
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TrainingDaysScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: program, isLoading } = useActiveProgram();

  const trainingDaysPerWeek = program?.training_days_per_week ?? 3;
  const currentDays: number[] = useMemo(
    () =>
      program?.training_days ??
      DEFAULT_TRAINING_DAYS[trainingDaysPerWeek] ?? [1, 3, 5],
    [program?.training_days, trainingDaysPerWeek]
  );

  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentDays.length > 0) setSelectedDays(currentDays);
  }, [currentDays]);

  const daysValid = selectedDays.length === trainingDaysPerWeek;
  const daysChanged = daysValid && !arraysEqual(selectedDays, currentDays);
  const canSave = daysChanged && !isSaving;

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      if (prev.length >= trainingDaysPerWeek) return prev;
      return [...prev, day];
    });
  }

  async function doSave() {
    if (!program) return;
    setIsSaving(true);
    try {
      await updateTrainingDays(program.id, selectedDays, {
        program_mode: program.program_mode,
        start_date: program.start_date,
        training_days: program.training_days,
      });
      await queryClient.invalidateQueries({
        queryKey: qk.program.active(user?.id),
      });
      await queryClient.invalidateQueries({
        queryKey: qk.session.today(user?.id),
      });
      router.back();
    } catch (err) {
      captureException(err);
      Alert.alert('Error', 'Could not update training days. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    if (!program) return;

    if (program.program_mode === 'scheduled') {
      try {
        const count = await countFuturePlannedSessions(program.id);
        Alert.alert(
          'Update Training Days',
          `This will update dates for ${count} upcoming session${count === 1 ? '' : 's'}. Completed sessions won't change.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Update', onPress: doSave },
          ]
        );
      } catch (err) {
        captureException(err);
        Alert.alert('Error', 'Could not check upcoming sessions. Please try again.');
      }
    } else {
      doSave();
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={colors.textTertiary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!program) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <BackLink onPress={() => router.back()} />
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            No active program. Start a program to set training days.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.7}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.titleWrap}>
          <ScreenTitle marginBottom={spacing[1]}>Training Days</ScreenTitle>
          <Text style={styles.subtitle}>
            Choose which days of the week you train
          </Text>
        </View>

        <Text style={styles.sectionLabel}>
          Select {trainingDaysPerWeek} days
        </Text>
        <View style={styles.dayRow}>
          {DAY_LABELS.map((label, weekday) => {
            const active = selectedDays.includes(weekday);
            return (
              <TouchableOpacity
                key={weekday}
                style={[styles.dayChip, active && styles.dayChipActive]}
                onPress={() => toggleDay(weekday)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    active && styles.dayChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!daysValid && (
          <Text style={styles.hint}>
            Select exactly {trainingDaysPerWeek} days
          </Text>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            {program.program_mode === 'scheduled'
              ? 'Changing days will shift the dates of all upcoming planned sessions. Completed sessions are not affected.'
              : 'Your next session will be scheduled on the new days. No existing sessions are affected.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
