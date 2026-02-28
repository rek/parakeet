import { useEffect, useState } from 'react'
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../../hooks/useAuth'
import { getCycleConfig, updateCycleConfig } from '../../lib/cycle-tracking'
import { computeCyclePhase } from '@parakeet/training-engine'
import { BackLink } from '../../components/navigation/BackLink'
import { colors, spacing, radii, typography } from '../../theme'
import { qk } from '../../queries/keys'

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  menstrual:   '#FEE2E2',
  follicular:  '#D1FAE5',
  ovulatory:   '#FEF3C7',
  luteal:      '#E0E7FF',
  late_luteal: '#E0E7FF',
}

const PHASE_TEXT_COLORS: Record<string, string> = {
  menstrual:   '#991B1B',
  follicular:  '#065F46',
  ovulatory:   '#92400E',
  luteal:      '#3730A3',
  late_luteal: '#3730A3',
}

const PHASE_LABELS: Record<string, string> = {
  menstrual:   'Menstrual',
  follicular:  'Follicular',
  ovulatory:   'Ovulatory',
  luteal:      'Luteal',
  late_luteal: 'Late Luteal',
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

// ── Phase calendar helpers ────────────────────────────────────────────────────

function getPhaseForDay(day: number, cycleLength: number): string {
  const scaled = cycleLength === 28 ? day : Math.round(day * 28 / cycleLength)
  if (scaled <= 5)       return 'menstrual'
  if (scaled <= 11)      return 'follicular'
  if (scaled <= 16)      return 'ovulatory'
  if (scaled <= 23)      return 'luteal'
  return 'late_luteal'
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CycleTrackingScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [isEnabled, setIsEnabled] = useState(false)
  const [cycleLength, setCycleLength] = useState(28)
  const [lastPeriodStart, setLastPeriodStart] = useState<string | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    getCycleConfig(user.id)
      .then((cfg) => {
        setIsEnabled(cfg.is_enabled)
        setCycleLength(cfg.cycle_length_days)
        setLastPeriodStart(cfg.last_period_start)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id])

  async function save(update: Parameters<typeof updateCycleConfig>[1]) {
    if (!user?.id) return
    await updateCycleConfig(user.id, update)
    await queryClient.invalidateQueries({ queryKey: qk.cycle.phase(user.id) })
    await queryClient.invalidateQueries({ queryKey: qk.cycle.config(user.id) })
  }

  async function handleToggle(value: boolean) {
    setIsEnabled(value)
    if (value && !lastPeriodStart) {
      setShowDatePicker(true)
    }
    await save({ is_enabled: value })
  }

  async function handleCycleLengthChange(delta: number) {
    const next = Math.min(35, Math.max(24, cycleLength + delta))
    setCycleLength(next)
    await save({ cycle_length_days: next })
  }

  function handleDateChange(_event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false)
    if (!selected) return
    const iso = selected.toISOString().split('T')[0]
    setLastPeriodStart(iso)
    save({ last_period_start: iso }).catch(() => {})
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const cycleContext = isEnabled && lastPeriodStart
    ? computeCyclePhase(new Date(lastPeriodStart), cycleLength)
    : null

  const nextPeriodDate = lastPeriodStart
    ? (() => {
        const d = new Date(lastPeriodStart)
        d.setDate(d.getDate() + cycleLength)
        return d.toISOString().split('T')[0]
      })()
    : null

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
          <Text style={styles.title}>Cycle Tracking</Text>
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
                  trackColor={{ false: colors.borderMuted, true: colors.primary }}
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
                  style={[styles.stepperBtn, !isEnabled && styles.stepperBtnDisabled]}
                  onPress={() => isEnabled && handleCycleLengthChange(-1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.stepperValue, !isEnabled && styles.textDisabled]}>
                  {cycleLength} days
                </Text>
                <TouchableOpacity
                  style={[styles.stepperBtn, !isEnabled && styles.stepperBtnDisabled]}
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
                <Text style={[styles.dateText, !isEnabled && styles.textDisabled]}>
                  {lastPeriodStart ? formatDate(lastPeriodStart) : 'Not set'}
                </Text>
                <TouchableOpacity
                  onPress={() => isEnabled && setShowDatePicker((v) => !v)}
                  activeOpacity={0.7}
                  disabled={!isEnabled}
                >
                  <Text style={[styles.updateLink, !isEnabled && styles.textDisabled]}>
                    Update
                  </Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && isEnabled && (
                <>
                  <DateTimePicker
                    value={lastPeriodStart ? new Date(lastPeriodStart) : new Date()}
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
              <View style={[styles.card, { backgroundColor: PHASE_COLORS[cycleContext.phase] }]}>
                <Text style={[styles.phaseCurrentLabel, { color: PHASE_TEXT_COLORS[cycleContext.phase] }]}>
                  Currently: {PHASE_LABELS[cycleContext.phase]} · Day {cycleContext.dayOfCycle}
                </Text>
                <Text style={[styles.phaseNextPeriod, { color: PHASE_TEXT_COLORS[cycleContext.phase] }]}>
                  Next period expected: {nextPeriodDate ? formatDate(nextPeriodDate) : '—'}
                </Text>
              </View>
            )}

            {/* Phase calendar */}
            {isEnabled && lastPeriodStart && (
              <View style={styles.card}>
                <Text style={styles.calendarTitle}>Cycle Overview</Text>
                <View style={styles.calendarGrid}>
                  {Array.from({ length: cycleLength }, (_, i) => {
                    const day = i + 1
                    const phase = getPhaseForDay(day, cycleLength)
                    const isCurrent = cycleContext?.dayOfCycle === day
                    return (
                      <View
                        key={day}
                        style={[
                          styles.calendarDay,
                          { backgroundColor: PHASE_COLORS[phase] },
                          isCurrent && styles.calendarDayCurrent,
                        ]}
                      >
                        <Text style={[
                          styles.calendarDayText,
                          { color: PHASE_TEXT_COLORS[phase] },
                          isCurrent && styles.calendarDayTextCurrent,
                        ]}>
                          {day}
                        </Text>
                      </View>
                    )
                  })}
                </View>

                {/* Legend */}
                <View style={styles.legend}>
                  {(['menstrual', 'follicular', 'ovulatory', 'luteal', 'late_luteal'] as const).map((phase) => (
                    <View key={phase} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: PHASE_COLORS[phase] }]} />
                      <Text style={styles.legendLabel}>{PHASE_LABELS[phase]}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.black,
    color: colors.text,
    marginTop: spacing[2],
    letterSpacing: typography.letterSpacing.tight,
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
})
