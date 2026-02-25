import { useState } from 'react'
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
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
import { updateProfile } from '../../../lib/profile'
import type { BiologicalSex } from '../../../lib/profile'

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
  const params = useLocalSearchParams<{ lifts: string }>()
  const lifts = JSON.parse(params.lifts ?? '{}') as LiftsPayload

  const [totalWeeks, setTotalWeeks] = useState<TotalWeeks>(10)
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState<TrainingDays>(3)
  const [startDate, setStartDate] = useState<Date>(nextMonday)
  const [showPicker, setShowPicker] = useState(false)
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex>('prefer_not_to_say')
  const [birthYear, setBirthYear] = useState('')
  const [loading, setLoading] = useState(false)

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
    try {
      setLoading(true)
      const yearNum = parseInt(birthYear, 10)
      const dobIso = !isNaN(yearNum) && birthYear.length === 4
        ? `${yearNum}-01-01`
        : null
      await Promise.all([
        submitMaxes(lifts),
        updateProfile({
          biological_sex: biologicalSex,
          date_of_birth: dobIso,
        }),
      ])
      const program = await createProgram({ totalWeeks, trainingDaysPerWeek, startDate })
      router.replace({
        pathname: '/(auth)/onboarding/review',
        params: { programId: program!.id },
      })
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create program')
    } finally {
      setLoading(false)
    }
  }

  const WEEK_OPTIONS: TotalWeeks[] = [10, 12, 14]
  const DAY_OPTIONS: TrainingDays[] = [3, 4]

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

      {/* Biological sex */}
      <Text style={styles.label}>Biological Sex</Text>
      <Text style={styles.fieldHint}>Used for volume defaults calibrated to your physiology</Text>
      <View style={[styles.toggle, styles.toggleMarginTop]}>
        {(['female', 'male', 'prefer_not_to_say'] as BiologicalSex[]).map((option, index) => {
          const labels: Record<BiologicalSex, string> = {
            female: 'Female',
            male: 'Male',
            prefer_not_to_say: 'Prefer not to say',
          }
          const isFirst = index === 0
          const isLast = index === 2
          const isActive = biologicalSex === option
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
              onPress={() => setBiologicalSex(option)}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleButtonText, isActive && styles.toggleButtonTextActive]}>
                {labels[option]}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Birth year */}
      <Text style={styles.label}>Birth Year</Text>
      <Text style={styles.fieldHint}>Optional · used for age-appropriate coaching insights</Text>
      <TextInput
        style={[styles.toggleMarginTop, styles.birthYearInput]}
        placeholder="e.g. 1990"
        placeholderTextColor="#9CA3AF"
        value={birthYear}
        onChangeText={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
      />

      {/* Generate button */}
      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
        onPress={handleGenerate}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Generate My Program</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 40,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 28,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  toggleButtonFirst: {
    // no extra style needed; border-radius handled by overflow on parent
  },
  toggleButtonLast: {
    // no extra style needed
  },
  toggleButtonBorderRight: {
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  toggleButtonActive: {
    backgroundColor: '#4F46E5',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 15,
    color: '#111827',
  },
  changeLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fieldHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
    lineHeight: 16,
  },
  toggleMarginTop: {
    marginBottom: 28,
  },
  birthYearInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
})
