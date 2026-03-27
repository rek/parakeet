import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@modules/auth';
import {
  addPeriodStart,
  clampCycleLength,
  computeCyclePhase,
  computeNextPeriodDate,
  CYCLE_PHASE_BG,
  CYCLE_PHASE_LABELS,
  CYCLE_PHASE_TEXT,
  CYCLE_PHASES,
  deletePeriodStart,
  getCycleConfig,
  getPeriodStartHistory,
  getPhaseForDay,
  updateCycleConfig,
} from '@modules/cycle-tracking';
import type { PeriodStartEntry } from '@modules/cycle-tracking';
import { qk } from '@platform/query';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { formatDate } from '@shared/utils/date';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../components/navigation/BackLink';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import type { ColorScheme } from '../../theme';
import { radii, spacing, typography } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

// ── Styles ────────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    scrollView: { flex: 1 },
    container: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[12],
      gap: spacing[3],
    },
    headerRow: {
      marginBottom: spacing[2],
    },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
    },
    cardDisabled: {
      opacity: 0.5,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[3],
    },
    toggleTextWrap: { flex: 1 },
    toggleLabel: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing[0.5],
    },
    toggleHint: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    fieldLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
      marginBottom: spacing[2],
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[4],
      marginBottom: spacing[3],
    },
    stepperBtn: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgMuted,
    },
    stepperBtnDisabled: { opacity: 0.4 },
    stepperBtnText: {
      fontSize: 20,
      fontWeight: typography.weights.bold,
      color: colors.text,
      lineHeight: 22,
    },
    stepperValue: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.text,
      minWidth: 80,
      textAlign: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderMuted,
      marginBottom: spacing[3],
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateText: {
      fontSize: typography.sizes.base,
      color: colors.text,
    },
    updateLink: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    textDisabled: { color: colors.textTertiary },
    phaseCurrentLabel: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      marginBottom: spacing[1],
    },
    phaseNextPeriod: {
      fontSize: typography.sizes.sm,
    },
    calendarTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
      marginBottom: spacing[3],
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginBottom: spacing[3],
    },
    calendarDay: {
      width: 28,
      height: 28,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calendarDayCurrent: {
      borderWidth: 2,
      borderColor: colors.text,
    },
    calendarDayText: {
      fontSize: 10,
      fontWeight: typography.weights.semibold,
    },
    calendarDayTextCurrent: {
      fontWeight: typography.weights.black,
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: radii.full,
    },
    legendLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
    },
    doneBtn: {
      marginTop: spacing[2],
      alignItems: 'center',
      paddingVertical: spacing[3],
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    doneBtnText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing[2],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    historyDate: {
      fontSize: typography.sizes.base,
      color: colors.text,
    },
    deleteLink: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.danger,
    },
    emptyHint: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CycleTrackingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isEnabled, setIsEnabled] = useState(false);
  const [cycleLength, setCycleLength] = useState(28);
  const [lastPeriodStart, setLastPeriodStart] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PeriodStartEntry[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    getCycleConfig(user.id)
      .then((cfg) => {
        setIsEnabled(cfg.is_enabled);
        setCycleLength(cfg.cycle_length_days);
        setLastPeriodStart(cfg.last_period_start);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    getPeriodStartHistory(user.id)
      .then(setHistory)
      .catch(() => {});
  }, [user?.id]);

  async function save(update: Parameters<typeof updateCycleConfig>[1]) {
    if (!user?.id) return;
    await updateCycleConfig(user.id, update);
    await queryClient.invalidateQueries({ queryKey: qk.cycle.phase(user.id) });
    await queryClient.invalidateQueries({ queryKey: qk.cycle.config(user.id) });
  }

  async function handleToggle(value: boolean) {
    setIsEnabled(value);
    if (value && !lastPeriodStart) {
      setShowDatePicker(true);
    }
    await save({ is_enabled: value });
  }

  async function handleCycleLengthChange(delta: number) {
    const next = clampCycleLength(cycleLength + delta);
    setCycleLength(next);
    await save({ cycle_length_days: next });
  }

  async function handleDateChange(
    _event: DateTimePickerEvent,
    selected?: Date
  ) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (!selected || !user?.id) return;
    const iso = selected.toISOString().split('T')[0];
    const updated = await addPeriodStart(user.id, iso);
    setHistory(updated);
    setLastPeriodStart(updated[0]?.start_date ?? null);
    await queryClient.invalidateQueries({ queryKey: qk.cycle.phase(user.id) });
    await queryClient.invalidateQueries({ queryKey: qk.cycle.config(user.id) });
  }

  async function handleDeleteEntry(entryId: string) {
    if (!user?.id) return;
    const updated = await deletePeriodStart(user.id, entryId);
    setHistory(updated);
    setLastPeriodStart(updated[0]?.start_date ?? null);
    await queryClient.invalidateQueries({ queryKey: qk.cycle.phase(user.id) });
    await queryClient.invalidateQueries({ queryKey: qk.cycle.config(user.id) });
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const cycleContext =
    isEnabled && lastPeriodStart
      ? computeCyclePhase(new Date(lastPeriodStart), cycleLength)
      : null;

  const nextPeriodDate = lastPeriodStart
    ? computeNextPeriodDate(lastPeriodStart, cycleLength)
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <BackLink onPress={() => router.back()} />
          <ScreenTitle>Cycle Tracking</ScreenTitle>
        </View>

        {loading ? null : (
          <>
            {/* Enable toggle */}
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.toggleLabel}>Track menstrual cycle</Text>
                  <Text style={styles.toggleHint}>
                    Adds context to your training — no symptoms required
                  </Text>
                </View>
                <Switch
                  value={isEnabled}
                  onValueChange={handleToggle}
                  trackColor={{
                    false: colors.borderMuted,
                    true: colors.primary,
                  }}
                  thumbColor={colors.textInverse}
                />
              </View>
            </View>

            {/* Sub-fields — grayed when disabled */}
            <View style={[styles.card, !isEnabled && styles.cardDisabled]}>
              {/* Cycle length stepper */}
              <Text style={styles.fieldLabel}>Avg cycle length</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[
                    styles.stepperBtn,
                    !isEnabled && styles.stepperBtnDisabled,
                  ]}
                  onPress={() => isEnabled && handleCycleLengthChange(-1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <Text
                  style={[
                    styles.stepperValue,
                    !isEnabled && styles.textDisabled,
                  ]}
                >
                  {cycleLength} days
                </Text>
                <TouchableOpacity
                  style={[
                    styles.stepperBtn,
                    !isEnabled && styles.stepperBtnDisabled,
                  ]}
                  onPress={() => isEnabled && handleCycleLengthChange(1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Last period start */}
              <Text style={styles.fieldLabel}>Last period started</Text>
              <View style={styles.dateRow}>
                <Text
                  style={[styles.dateText, !isEnabled && styles.textDisabled]}
                >
                  {lastPeriodStart ? formatDate(lastPeriodStart) : 'Not set'}
                </Text>
                <TouchableOpacity
                  onPress={() => isEnabled && setShowDatePicker((v) => !v)}
                  activeOpacity={0.7}
                  disabled={!isEnabled}
                >
                  <Text
                    style={[
                      styles.updateLink,
                      !isEnabled && styles.textDisabled,
                    ]}
                  >
                    Update
                  </Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && isEnabled && (
                <>
                  <DateTimePicker
                    value={
                      lastPeriodStart ? new Date(lastPeriodStart) : new Date()
                    }
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    maximumDate={new Date()}
                    onChange={handleDateChange}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={styles.doneBtn}
                      onPress={() => setShowDatePicker(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.doneBtnText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* Current phase display */}
            {cycleContext && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: CYCLE_PHASE_BG[cycleContext.phase] },
                ]}
              >
                <Text
                  style={[
                    styles.phaseCurrentLabel,
                    { color: CYCLE_PHASE_TEXT[cycleContext.phase] },
                  ]}
                >
                  Currently: {CYCLE_PHASE_LABELS[cycleContext.phase]} · Day{' '}
                  {cycleContext.dayOfCycle}
                </Text>
                <Text
                  style={[
                    styles.phaseNextPeriod,
                    { color: CYCLE_PHASE_TEXT[cycleContext.phase] },
                  ]}
                >
                  Next period expected:{' '}
                  {nextPeriodDate ? formatDate(nextPeriodDate) : '—'}
                </Text>
              </View>
            )}

            {/* Period history */}
            {isEnabled && (
              <View style={styles.card}>
                <Text style={styles.calendarTitle}>Period History</Text>
                {history.length === 0 ? (
                  <Text style={styles.emptyHint}>
                    No entries yet — update the date above to record one.
                  </Text>
                ) : (
                  history.map((entry) => (
                    <View key={entry.id} style={styles.historyRow}>
                      <Text style={styles.historyDate}>
                        {formatDate(entry.start_date)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteEntry(entry.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.deleteLink}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Phase calendar */}
            {isEnabled && lastPeriodStart && (
              <View style={styles.card}>
                <Text style={styles.calendarTitle}>Cycle Overview</Text>
                <View style={styles.calendarGrid}>
                  {Array.from({ length: cycleLength }, (_, i) => {
                    const day = i + 1;
                    const phase = getPhaseForDay(day, cycleLength);
                    const isCurrent = cycleContext?.dayOfCycle === day;
                    return (
                      <View
                        key={day}
                        style={[
                          styles.calendarDay,
                          { backgroundColor: CYCLE_PHASE_BG[phase] },
                          isCurrent && styles.calendarDayCurrent,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            { color: CYCLE_PHASE_TEXT[phase] },
                            isCurrent && styles.calendarDayTextCurrent,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Legend */}
                <View style={styles.legend}>
                  {CYCLE_PHASES.map((phase) => (
                    <View key={phase} style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: CYCLE_PHASE_BG[phase] },
                        ]}
                      />
                      <Text style={styles.legendLabel}>
                        {CYCLE_PHASE_LABELS[phase]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
