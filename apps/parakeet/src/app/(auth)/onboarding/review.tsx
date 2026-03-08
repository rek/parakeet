import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'

import { createProgram } from '@modules/program'
import { useAuth } from '@modules/auth'
import { qk } from '@platform/query'
import { generateProgram, nextDateForWeekday, DEFAULT_TRAINING_DAYS } from '@parakeet/training-engine'
import { captureException } from '@platform/utils/captureException'
import { capitalize } from '@shared/utils/string'
import { colors, spacing, typography, radii } from '../../../theme'

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSessionDate(date: Date): string {
  return `${DAY_LABELS[date.getDay()]} ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { totalWeeks: tw, trainingDaysPerWeek: tdpw, programMode: pm } = useLocalSearchParams<{
    totalWeeks: string
    trainingDaysPerWeek: string
    programMode?: string
  }>()

  const totalWeeks = Number(tw)
  const trainingDaysPerWeek = Number(tdpw) as 3 | 4
  const isUnending = pm === 'unending'

  const [selectedDays, setSelectedDays] = useState<number[]>(
    () => DEFAULT_TRAINING_DAYS[trainingDaysPerWeek] ?? [1, 3, 5],
  )
  const [loading, setLoading] = useState(false)

  // startDate = next occurrence of the earliest selected day
  const startDate = useMemo(() => {
    const sorted = [...selectedDays].sort((a, b) => a - b)
    return nextDateForWeekday(sorted[0])
  }, [selectedDays])

  // Compute week 1 preview locally — no DB call needed (scheduled only)
  const week1Sessions = useMemo(() => {
    if (isUnending) return []
    if (!totalWeeks || !trainingDaysPerWeek || selectedDays.length !== trainingDaysPerWeek) return []
    const result = generateProgram({
      totalWeeks,
      trainingDaysPerWeek,
      startDate,
      trainingDays: selectedDays,
    })
    return result.sessions
      .filter((s) => s.weekNumber === 1)
      .sort((a, b) => a.dayNumber - b.dayNumber)
  }, [isUnending, selectedDays, startDate, totalWeeks, trainingDaysPerWeek])

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day)
      } else {
        // Don't allow exceeding required count
        if (prev.length >= trainingDaysPerWeek) return prev
        return [...prev, day]
      }
    })
  }

  async function handleStart() {
    setLoading(true)
    try {
      await createProgram({
        totalWeeks: isUnending ? undefined : totalWeeks as 10 | 12 | 14,
        trainingDaysPerWeek,
        startDate,
        trainingDays: selectedDays,
        programMode: isUnending ? 'unending' : 'scheduled',
      })
      await queryClient.invalidateQueries({ queryKey: qk.program.active(user?.id) })
      router.replace('/(tabs)/today')
    } catch (err) {
      captureException(err)
    } finally {
      setLoading(false)
    }
  }

  const daysSelected = selectedDays.length === trainingDaysPerWeek

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Schedule</Text>
          <Text style={styles.subtitle}>
            {isUnending
              ? `Unending program · pick your ${trainingDaysPerWeek} training days`
              : `${totalWeeks}-week program · pick your ${trainingDaysPerWeek} training days`}
          </Text>
        </View>

        {/* Day picker */}
        <Text style={styles.sectionLabel}>Training Days</Text>
        <View style={styles.dayRow}>
          {DAY_LABELS.map((label, weekday) => {
            const active = selectedDays.includes(weekday)
            return (
              <TouchableOpacity
                key={weekday}
                style={[styles.dayChip, active && styles.dayChipActive]}
                onPress={() => toggleDay(weekday)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
        {!daysSelected && (
          <Text style={styles.dayHint}>
            Select exactly {trainingDaysPerWeek} days
          </Text>
        )}

        {/* Preview section */}
        {isUnending ? (
          <>
            <Text style={styles.sectionLabel}>First Session</Text>
            <View style={styles.unendingPreview}>
              <Text style={styles.unendingPreviewTitle}>Squat · Heavy · Block 1</Text>
              <Text style={styles.unendingPreviewNote}>
                Your first workout is ready to go. After each session, the next one is generated fresh from your results.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Week 1 Preview</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sessionsRow}
              style={styles.sessionsScroll}
            >
              {week1Sessions.map((session, i) => (
                <View key={i} style={styles.sessionCard}>
                  <Text style={styles.cardDay}>
                    {formatSessionDate(session.plannedDate)}
                  </Text>
                  <Text style={styles.cardLift}>{capitalize(session.primaryLift)}</Text>
                  <Text style={styles.cardIntensity}>{session.intensityType}</Text>
                  <View style={styles.cardDivider} />
                  <Text style={styles.cardNote}>Sets generated before workout</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, (!daysSelected || loading) && styles.primaryButtonDisabled]}
          onPress={handleStart}
          disabled={!daysSelected || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Start Training</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editLink}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.editLinkText}>Edit Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgSurface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  dayRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: spacing[2],
    marginBottom: 8,
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
  dayHint: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  sessionsScroll: {
    flexGrow: 0,
    marginBottom: 32,
  },
  sessionsRow: {
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  sessionCard: {
    width: 160,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginRight: 12,
  },
  cardDay: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6,
  },
  cardLift: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  cardIntensity: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.bgMuted,
    marginBottom: 10,
  },
  cardNote: {
    fontSize: 11,
    color: colors.border,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    backgroundColor: colors.bgSurface,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  editLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  editLinkText: {
    fontSize: 14,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  unendingPreview: {
    marginHorizontal: 24,
    marginBottom: 32,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  unendingPreviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  unendingPreviewNote: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
})
