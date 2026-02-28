import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'

import { submitMaxes } from '../../../lib/lifter-maxes'
import { createProgram } from '../../../lib/programs'
import { getProfile, updateProfile } from '../../../lib/profile'
import { updateCycleConfig } from '../../../lib/cycle-tracking'
import { useAuth } from '../../../hooks/useAuth'
import { qk } from '../../../queries/keys'
import type { BiologicalSex } from '../../../lib/profile'
import { colors } from '../../../theme'

// ── Types ────────────────────────────────────────────────────────────────────

type TotalWeeks = 10 | 12 | 14
type TrainingDays = 3 | 4

interface LiftInput {
  type: '1rm' | '3rm'
  weightKg: number
  reps?: number
}

interface LiftsPayload {
  squat: LiftInput
  bench: LiftInput
  deadlift: LiftInput
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nextMonday(): Date {
  const d = new Date()
  const day = d.getDay() // 0=Sun
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + daysUntilMonday)
  d.setHours(0, 0, 0, 0)
  return d
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatStartDate(date: Date): string {
  const weekday = WEEKDAY_NAMES[date.getDay()]
  const month = MONTH_NAMES[date.getMonth()]
  const day = date.getDate()
  return `${weekday} ${month} ${day}`
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ProgramSettingsScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const params = useLocalSearchParams<{ lifts?: string; estimatedStart?: string }>()
  const usingEstimatedStart = params.estimatedStart === '1'
  const lifts = useMemo(() => {
    if (!params.lifts) return null
    try {
      return JSON.parse(params.lifts) as LiftsPayload
    } catch {
      return null
    }
  }, [params.lifts])

  const [totalWeeks, setTotalWeeks] = useState<TotalWeeks>(10)
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState<TrainingDays>(3)
  const [startDate, setStartDate] = useState<Date>(nextMonday)
  const [showPicker, setShowPicker] = useState(false)
  const [gender, setGender] = useState<BiologicalSex | null>(null)
  const [birthYear, setBirthYear] = useState('')
  // Cycle tracking onboarding (female only)
  const [cycleTrackingEnabled, setCycleTrackingEnabled] = useState(false)
  const [cycleLength, setCycleLength] = useState(28)
  const [lastPeriodStart, setLastPeriodStart] = useState<Date | null>(null)
  const [showCyclePicker, setShowCyclePicker] = useState(false)
  const [bodyweightKg, setBodyweightKg] = useState('')
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [hasProfileGender, setHasProfileGender] = useState(false)
  const [hasProfileBirthYear, setHasProfileBirthYear] = useState(false)
  const [hasProfileBodyweight, setHasProfileBodyweight] = useState(false)
  const birthYearIsValid = /^\d{4}$/.test(birthYear)
  const bodyweightIsValid = parseFloat(bodyweightKg) > 0

  useEffect(() => {
    getProfile()
      .then((profile) => {
        if (profile?.biological_sex) {
          setGender(profile.biological_sex)
          setHasProfileGender(true)
        }
        if (profile?.date_of_birth) {
          setBirthYear(profile.date_of_birth.slice(0, 4))
          setHasProfileBirthYear(true)
        }
        if (profile?.bodyweight_kg) {
          setBodyweightKg(String(profile.bodyweight_kg))
          setHasProfileBodyweight(true)
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false))
  }, [])

  function handleDateChange(_event: DateTimePickerEvent, selected?: Date) {
    // On Android the picker closes itself; on iOS it stays open (inline)
    if (Platform.OS === 'android') {
      setShowPicker(false)
    }
    if (selected) {
      setStartDate(selected)
    }
  }

  async function handleGenerate() {
    if (!gender) {
      Alert.alert('Missing info', 'Select a gender to generate your program.')
      return
    }
    if (!birthYearIsValid) {
      Alert.alert('Missing info', 'Enter your 4-digit birth year to generate your program.')
      return
    }
    try {
      setLoading(true)
      const yearNum = parseInt(birthYear, 10)
      const dobIso = `${yearNum}-01-01`
      if (!usingEstimatedStart && !lifts) {
        throw new Error('Missing lift maxes input')
      }

      const updates: Promise<unknown>[] = []

      if (!hasProfileGender || !hasProfileBirthYear || !hasProfileBodyweight) {
        updates.push(updateProfile({
          ...(!hasProfileGender ? { biological_sex: gender } : {}),
          ...(!hasProfileBirthYear ? { date_of_birth: dobIso } : {}),
          ...(!hasProfileBodyweight ? { bodyweight_kg: parseFloat(bodyweightKg) } : {}),
        }))
      }

      if (!usingEstimatedStart && lifts) {
        updates.push(submitMaxes(lifts))
      }

      if (cycleTrackingEnabled) {
        updates.push(updateCycleConfig(user!.id, {
          is_enabled: true,
          cycle_length_days: cycleLength,
          last_period_start: lastPeriodStart ? lastPeriodStart.toISOString().split('T')[0] : null,
        }))
      }

      await Promise.all(updates)
      const program = await createProgram({ totalWeeks, trainingDaysPerWeek, startDate })
      await queryClient.invalidateQueries({ queryKey: qk.program.active(user?.id) })
      router.replace({
        pathname: '/(auth)/onboarding/review',
        params: { programId: program!.id },
      })
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? 'Failed to create program'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  const WEEK_OPTIONS: TotalWeeks[] = [10, 12, 14]
  const DAY_OPTIONS: TrainingDays[] = [3, 4]
  const canGenerate = !loading && !profileLoading && !!gender && birthYearIsValid && (hasProfileBodyweight || bodyweightIsValid)

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Program Settings</Text>
      <Text style={styles.subtitle}>Customize your training block before we build your program.</Text>

      {/* Duration */}
      <Text style={styles.label}>Duration</Text>
      <View style={styles.toggle}>
        {WEEK_OPTIONS.map((weeks, index) => {
          const isFirst = index === 0
          const isLast = index === WEEK_OPTIONS.length - 1
          const isActive = totalWeeks === weeks
          return (
            <TouchableOpacity
              key={weeks}
              style={[
                styles.toggleButton,
                isFirst && styles.toggleButtonFirst,
                isLast && styles.toggleButtonLast,
                !isLast && styles.toggleButtonBorderRight,
                isActive && styles.toggleButtonActive,
              ]}
              onPress={() => setTotalWeeks(weeks)}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleButtonText, isActive && styles.toggleButtonTextActive]}>
                {weeks} weeks
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Days per week */}
      <Text style={styles.label}>Days / Week</Text>
      <View style={styles.toggle}>
        {DAY_OPTIONS.map((days, index) => {
          const isFirst = index === 0
          const isLast = index === DAY_OPTIONS.length - 1
          const isActive = trainingDaysPerWeek === days
          return (
            <TouchableOpacity
              key={days}
              style={[
                styles.toggleButton,
                isFirst && styles.toggleButtonFirst,
                isLast && styles.toggleButtonLast,
                !isLast && styles.toggleButtonBorderRight,
                isActive && styles.toggleButtonActive,
              ]}
              onPress={() => setTrainingDaysPerWeek(days)}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleButtonText, isActive && styles.toggleButtonTextActive]}>
                {days} days
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Start date */}
      <Text style={styles.label}>Start Date</Text>
      <View style={styles.dateRow}>
        <Text style={styles.dateText}>Starting: {formatStartDate(startDate)}</Text>
        <TouchableOpacity onPress={() => setShowPicker((v) => !v)} activeOpacity={0.7}>
          <Text style={styles.changeLink}>Change</Text>
        </TouchableOpacity>
      </View>

      {showPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={new Date()}
          onChange={handleDateChange}
        />
      )}

      {/* Gender */}
      {!hasProfileGender && (
        <>
          <Text style={styles.label}>Gender</Text>
          <Text style={styles.fieldHint}>Used for volume defaults calibrated to your physiology</Text>
          <View style={[styles.toggle, styles.toggleMarginTop]}>
            {(['female', 'male'] as BiologicalSex[]).map((option, index) => {
              const labels: Record<BiologicalSex, string> = {
                female: 'Female',
                male: 'Male',
              }
              const isFirst = index === 0
              const isLast = index === 1
              const isActive = gender === option
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.toggleButton,
                    isFirst && styles.toggleButtonFirst,
                    isLast && styles.toggleButtonLast,
                    !isLast && styles.toggleButtonBorderRight,
                    isActive && styles.toggleButtonActive,
                  ]}
                  onPress={() => setGender(option)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.toggleButtonText, isActive && styles.toggleButtonTextActive]}>
                    {labels[option]}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </>
      )}

      {/* Birth year */}
      {!hasProfileBirthYear && (
        <>
          <Text style={styles.label}>Birth Year</Text>
          <Text style={styles.fieldHint}>Required · used for age-appropriate coaching insights</Text>
          <TextInput
            style={[styles.toggleMarginTop, styles.birthYearInput, birthYear.length > 0 && !birthYearIsValid && styles.birthYearInputError]}
            placeholder="e.g. 1990"
            placeholderTextColor={colors.textTertiary}
            value={birthYear}
            onChangeText={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
          />
        </>
      )}

      {/* Body weight */}
      {!hasProfileBodyweight && (
        <>
          <Text style={styles.label}>Body Weight</Text>
          <Text style={styles.fieldHint}>Required · used for Wilks score calculations</Text>
          <TextInput
            style={[styles.toggleMarginTop, styles.birthYearInput, bodyweightKg.length > 0 && !bodyweightIsValid && styles.birthYearInputError]}
            placeholder="e.g. 80.5 kg"
            placeholderTextColor={colors.textTertiary}
            value={bodyweightKg}
            onChangeText={(v) => setBodyweightKg(v.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
          />
        </>
      )}

      {/* Cycle tracking prompt — female only */}
      {gender === 'female' && (
        <>
          <Text style={styles.label}>Cycle Tracking</Text>
          <Text style={styles.fieldHint}>
            Track your menstrual cycle to add context to training patterns — no symptoms required. You can always change this in Settings.
          </Text>
          <View style={styles.cycleToggleRow}>
            <Text style={styles.cycleToggleLabel}>Enable cycle tracking</Text>
            <Switch
              value={cycleTrackingEnabled}
              onValueChange={setCycleTrackingEnabled}
              trackColor={{ false: colors.borderMuted, true: colors.primary }}
              thumbColor={colors.textInverse}
            />
          </View>

          {cycleTrackingEnabled && (
            <>
              {/* Cycle length */}
              <View style={styles.cycleLengthRow}>
                <Text style={styles.cycleLengthLabel}>Avg cycle length</Text>
                <View style={styles.cycleStepper}>
                  <TouchableOpacity
                    style={styles.cycleStepBtn}
                    onPress={() => setCycleLength((v) => Math.max(24, v - 1))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cycleStepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.cycleStepValue}>{cycleLength} days</Text>
                  <TouchableOpacity
                    style={styles.cycleStepBtn}
                    onPress={() => setCycleLength((v) => Math.min(35, v + 1))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cycleStepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Last period date */}
              <View style={styles.dateRow}>
                <Text style={styles.dateText}>
                  Last period:{' '}
                  {lastPeriodStart
                    ? lastPeriodStart.toISOString().split('T')[0]
                    : 'not set'}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowCyclePicker((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeLink}>Set date</Text>
                </TouchableOpacity>
              </View>

              {showCyclePicker && (
                <DateTimePicker
                  value={lastPeriodStart ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  maximumDate={new Date()}
                  onChange={(_e, d) => {
                    if (Platform.OS === 'android') setShowCyclePicker(false)
                    if (d) setLastPeriodStart(d)
                  }}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Generate button */}
      <TouchableOpacity
        style={[styles.primaryButton, !canGenerate && styles.primaryButtonDisabled]}
        onPress={handleGenerate}
        disabled={!canGenerate}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text style={styles.primaryButtonText}>Generate My Program</Text>
        )}
      </TouchableOpacity>
      {!canGenerate && !profileLoading ? (
        <Text style={styles.validationHint}>
          {[
            !gender && !hasProfileGender ? 'select gender' : null,
            !birthYearIsValid && !hasProfileBirthYear ? 'enter birth year' : null,
            !bodyweightIsValid && !hasProfileBodyweight ? 'enter body weight' : null,
          ]
            .filter(Boolean)
            .join(', ')
            .replace(/,([^,]*)$/, ' and$1')
            .replace(/^./, (c) => c.toUpperCase()) + ' to enable program generation.'}
        </Text>
      ) : null}
    </ScrollView>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.bgSurface,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 40,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 28,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
  },
  toggleButtonFirst: {
    // no extra style needed; border-radius handled by overflow on parent
  },
  toggleButtonLast: {
    // no extra style needed
  },
  toggleButtonBorderRight: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleButtonTextActive: {
    color: colors.textInverse,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 15,
    color: colors.text,
  },
  changeLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  validationHint: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  fieldHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 8,
    lineHeight: 16,
  },
  toggleMarginTop: {
    marginBottom: 28,
  },
  birthYearInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  birthYearInputError: {
    borderColor: colors.danger,
  },
  cycleToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  cycleToggleLabel: {
    fontSize: 15,
    color: colors.text,
  },
  cycleLengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cycleLengthLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  cycleStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cycleStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleStepBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  cycleStepValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    minWidth: 64,
    textAlign: 'center',
  },
})
