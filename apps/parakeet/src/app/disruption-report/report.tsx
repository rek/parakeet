import { useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'

import {
  applyDisruptionAdjustment,
  applyUnprogrammedEventSoreness,
  getMenstrualSymptomsPreset,
  inferEffectiveSeverity,
  reportDisruption,
  SORENESS_NUMERIC,
} from '@modules/disruptions'
import type { SorenessLevel } from '@modules/disruptions'
import { captureException } from '@platform/utils/captureException'
import { useAuth } from '@modules/auth'
import { getProfile } from '@modules/profile'
import type {
  AdjustmentSuggestion,
  DisruptionType,
  Severity,
  DisruptionWithSuggestions,
  Lift,
} from '@parakeet/shared-types'
import { colors } from '../../theme'
import { BackLink } from '../../components/navigation/BackLink'
import { qk } from '@platform/query'
import { SORENESS_MUSCLES_DEFAULT, TRAINING_LIFTS } from '@shared/constants/training'
import { localDateIso } from '@shared/utils/date'

// ── Constants ─────────────────────────────────────────────────────────────────

const DISRUPTION_TYPES: { value: DisruptionType; label: string; icon: string }[] = [
  { value: 'injury',               label: 'Injury',               icon: '🩹' },
  { value: 'illness',              label: 'Illness',              icon: '🤒' },
  { value: 'travel',               label: 'Travel',               icon: '✈️' },
  { value: 'fatigue',              label: 'Fatigue',              icon: '🔋' },
  { value: 'equipment_unavailable',label: 'No Equipment',         icon: '🏋️' },
  { value: 'unprogrammed_event',   label: 'Unplanned Event',      icon: '📅' },
  { value: 'other',                label: 'Other',                icon: '•' },
]

const SORENESS_CHIPS: { value: SorenessLevel; label: string }[] = [
  { value: 'none',      label: 'None' },
  { value: 'mild',      label: 'Mild' },
  { value: 'sore',      label: 'Sore' },
  { value: 'very_sore', label: 'Very Sore' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso(): string {
  return localDateIso(new Date())
}

function parseIso(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function formatDisplayDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function describeAction(suggestion: AdjustmentSuggestion): string {
  switch (suggestion.action) {
    case 'session_skipped':
      return 'Session skipped'
    case 'weight_reduced':
      return suggestion.reduction_pct != null
        ? `Weight reduced by ${suggestion.reduction_pct}%`
        : 'Weight reduced'
    case 'reps_reduced':
      return suggestion.reps_reduction != null
        ? `Reps reduced by ${suggestion.reps_reduction}`
        : 'Reps reduced'
    case 'exercise_substituted':
      return suggestion.substitution_note ?? 'Exercise substituted'
  }
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>
}

// ── Main screen ───────────────────────────────────────────────────────────────

type ScreenState = 'form' | 'review'

export default function DisruptionReportScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: qk.profile.current(),
    queryFn: getProfile,
    staleTime: 5 * 60 * 1000,
  })

  const isFemale = profile?.biological_sex === 'female'

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>('form')
  const [disruption, setDisruption] = useState<DisruptionWithSuggestions | null>(null)

  // Form values
  const [selectedType, setSelectedType]     = useState<DisruptionType | null>(null)
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | null>(null)
  const [startDate, setStartDate]           = useState(todayIso())
  const [isOngoing, setIsOngoing]           = useState(false)
  const [endDate, setEndDate]               = useState(todayIso())
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker]     = useState(false)
  const [selectedLifts, setSelectedLifts]   = useState<Set<Lift>>(new Set())
  const [allLifts, setAllLifts]             = useState(false)
  const [description, setDescription]       = useState('')
  const [isMenstrualSymptoms, setIsMenstrualSymptoms] = useState(false)
  const [eventName, setEventName] = useState('')
  const [eventSoreness, setEventSoreness] = useState<Record<string, SorenessLevel>>({})
  const [autoApplied, setAutoApplied] = useState(false)

  // Loading states
  const [isSubmitting, setIsSubmitting]   = useState(false)
  const [isApplying, setIsApplying]       = useState(false)
  const [submitError, setSubmitError]     = useState<string | null>(null)

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleMenstrualSymptoms() {
    if (isMenstrualSymptoms) {
      setIsMenstrualSymptoms(false)
      setSelectedType(null)
      setSelectedSeverity(null)
      setAllLifts(false)
      setSelectedLifts(new Set())
      setDescription('')
    } else {
      const preset = getMenstrualSymptomsPreset()
      setIsMenstrualSymptoms(true)
      setSelectedType(preset.type)
      setSelectedSeverity(preset.severity)
      setAllLifts(preset.allLifts)
      setSelectedLifts(preset.lifts)
      setDescription(preset.description)
    }
  }

  function toggleLift(lift: Lift) {
    const next = new Set(selectedLifts)
    if (next.has(lift)) {
      next.delete(lift)
    } else {
      next.add(lift)
    }
    setSelectedLifts(next)
    setAllLifts(false)
  }

  function toggleAllLifts() {
    if (allLifts) {
      setAllLifts(false)
      setSelectedLifts(new Set())
    } else {
      setAllLifts(true)
      setSelectedLifts(new Set(TRAINING_LIFTS))
    }
  }

  async function handleSubmit() {
    if (!selectedType || !user) return
    const effectiveSeverity = inferEffectiveSeverity(selectedType, selectedSeverity)
    if (!effectiveSeverity) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const effectiveDescription =
        selectedType === 'unprogrammed_event' && eventName.trim()
          ? `${eventName.trim()}${description.trim() ? ': ' + description.trim() : ''}`
          : description.trim() || undefined

      const result = await reportDisruption(user.id, {
        disruption_type:     selectedType,
        severity:            effectiveSeverity,
        affected_date_start: startDate,
        affected_date_end:   isOngoing ? undefined : endDate,
        affected_lifts:      allLifts ? undefined : (selectedLifts.size > 0 ? Array.from(selectedLifts) : undefined),
        description:         effectiveDescription,
      })

      if (effectiveSeverity === 'minor') {
        await applyDisruptionAdjustment(result.id, user.id)
        setAutoApplied(true)
      }

      if (selectedType === 'unprogrammed_event') {
        const numericSoreness = Object.fromEntries(
          Object.entries(eventSoreness).map(([m, l]) => [m, SORENESS_NUMERIC[l]]),
        )
        await applyUnprogrammedEventSoreness(user.id, numericSoreness)
      }

      void queryClient.invalidateQueries({ queryKey: ['disruptions', 'active', user.id] })
      setDisruption(result)
      setScreenState('review')
    } catch (err) {
      captureException(err)
      setSubmitError('Failed to submit. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleApply() {
    if (!disruption || !user) return
    setIsApplying(true)
    try {
      await applyDisruptionAdjustment(disruption.id, user.id)
      router.back()
    } finally {
      setIsApplying(false)
    }
  }

  const isUnprogrammedEvent = selectedType === 'unprogrammed_event'

  // ── Render: review state ─────────────────────────────────────────────────

  if (screenState === 'review' && disruption) {
    const suggestions = disruption.suggested_adjustments ?? []

    // Group by action label for a compact summary
    type GroupKey = string
    const groups = suggestions.reduce<Map<GroupKey, { s: AdjustmentSuggestion; count: number }>>(
      (acc, s) => {
        const key = describeAction(s)
        const existing = acc.get(key)
        if (existing) {
          existing.count++
        } else {
          acc.set(key, { s, count: 1 })
        }
        return acc
      },
      new Map(),
    )

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Review Adjustments</Text>
          <Text style={styles.subtitle}>
            Based on your {disruption.disruption_type.replace(/_/g, ' ')} ({disruption.severity}):
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {suggestions.length === 0 ? (
            <View style={styles.noAdjustments}>
              <Text style={styles.noAdjustmentsText}>
                {disruption.disruption_type === 'unprogrammed_event'
                  ? 'Soreness logged — upcoming sessions will auto-adjust.'
                  : 'No session adjustments needed — your upcoming sessions look fine.'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.adjustmentSummaryHeader}>
                {suggestions.length} session{suggestions.length !== 1 ? 's' : ''} affected
              </Text>
              {Array.from(groups.entries()).map(([label, { s, count }]) => (
                <View key={label} style={styles.adjustmentCard}>
                  <View style={[
                    styles.adjustmentBadge,
                    s.action === 'session_skipped' && styles.adjustmentBadgeSkip,
                  ]}>
                    <Text style={styles.adjustmentBadgeText}>{label}</Text>
                  </View>
                  <Text style={styles.adjustmentCount}>
                    {count} session{count !== 1 ? 's' : ''}
                  </Text>
                </View>
              ))}
            </>
          )}

          <View style={styles.reviewActions}>
            {autoApplied || disruption.disruption_type === 'unprogrammed_event' ? (
              <>
                <View style={styles.autoAppliedNote}>
                  <Text style={styles.autoAppliedNoteText}>
                    {autoApplied
                      ? 'Adjustments auto-applied (minor severity)'
                      : 'Soreness injected — no session changes required'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => router.back()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.skipButtonText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.applyButton, isApplying && styles.buttonDisabled]}
                  onPress={handleApply}
                  disabled={isApplying}
                  activeOpacity={0.8}
                >
                  {isApplying ? (
                    <ActivityIndicator color={colors.textInverse} size="small" />
                  ) : (
                    <Text style={styles.applyButtonText}>Apply All Adjustments</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => router.back()}
                  disabled={isApplying}
                  activeOpacity={0.8}
                >
                  <Text style={styles.skipButtonText}>Skip — Keep Original Plan</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Render: form state ───────────────────────────────────────────────────

  const canSubmit = !!selectedType && (isUnprogrammedEvent || !!selectedSeverity) && !isSubmitting

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
        <Text style={styles.title}>Report Issue</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Type */}
        <SectionLabel label="1. What happened?" />
        <View style={styles.typeGrid}>
          {DISRUPTION_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.typeCard, selectedType === t.value && !isMenstrualSymptoms && styles.typeCardSelected]}
              onPress={() => {
                setIsMenstrualSymptoms(false)
                setSelectedType(selectedType === t.value ? null : t.value)
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.typeIcon}>{t.icon}</Text>
              <Text style={[styles.typeLabel, selectedType === t.value && !isMenstrualSymptoms && styles.typeLabelSelected]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
          {isFemale && (
            <TouchableOpacity
              style={[styles.typeCard, isMenstrualSymptoms && styles.typeCardSelected]}
              onPress={handleMenstrualSymptoms}
              activeOpacity={0.7}
            >
              <Text style={styles.typeIcon}>🌸</Text>
              <Text style={[styles.typeLabel, isMenstrualSymptoms && styles.typeLabelSelected]}>
                Menstrual symptoms
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Step 2: Severity (hidden for unprogrammed events — fixed to major) */}
        {!isUnprogrammedEvent && (
        <>
        <SectionLabel label="2. How severe?" />
        <View style={styles.severityRow}>
          {(['minor', 'moderate', 'major'] as Severity[]).map((s) => {
            const severityPalette = {
              minor:    { bg: colors.warningMuted, border: colors.warning, text: colors.warning },
              moderate: { bg: colors.secondaryMuted, border: colors.secondary, text: colors.warning },
              major:    { bg: colors.dangerMuted, border: colors.danger, text: colors.danger },
            }
            const c = severityPalette[s]
            const selected = selectedSeverity === s
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.severityButton,
                  { borderColor: selected ? c.border : colors.border, backgroundColor: selected ? c.bg : colors.bgSurface },
                ]}
                onPress={() => setSelectedSeverity(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.severityText, selected && { color: c.text }]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
        </>
        )}

        {/* Step 3: Date range */}
        <SectionLabel label="3. When?" />
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateFieldLabel}>Start</Text>
            <TouchableOpacity
              style={styles.datePill}
              onPress={() => { setShowEndPicker(false); setShowStartPicker((v) => !v) }}
              activeOpacity={0.7}
            >
              <Text style={styles.datePillText}>{formatDisplayDate(startDate)}</Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                mode="date"
                value={parseIso(startDate)}
                maximumDate={new Date()}
                onChange={(_e: DateTimePickerEvent, d?: Date) => {
                  if (Platform.OS === 'android') setShowStartPicker(false)
                  if (d) setStartDate(localDateIso(d))
                }}
              />
            )}
          </View>
          {!isOngoing && (
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>End</Text>
              <TouchableOpacity
                style={styles.datePill}
                onPress={() => { setShowStartPicker(false); setShowEndPicker((v) => !v) }}
                activeOpacity={0.7}
              >
                <Text style={styles.datePillText}>{formatDisplayDate(endDate)}</Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  mode="date"
                  value={parseIso(endDate)}
                  minimumDate={parseIso(startDate)}
                  onChange={(_e: DateTimePickerEvent, d?: Date) => {
                    if (Platform.OS === 'android') setShowEndPicker(false)
                    if (d) setEndDate(localDateIso(d))
                  }}
                />
              )}
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.ongoingToggle}
          onPress={() => { setIsOngoing(!isOngoing); setShowEndPicker(false) }}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, isOngoing && styles.checkboxChecked]}>
            {isOngoing && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.ongoingLabel}>Ongoing (no end date)</Text>
        </TouchableOpacity>

        {/* Step 4: Affected lifts */}
        <SectionLabel label="4. Which lifts?" />
        <View style={styles.liftRow}>
          {TRAINING_LIFTS.map((lift) => (
            <TouchableOpacity
              key={lift}
              style={[styles.liftChip, selectedLifts.has(lift) && styles.liftChipSelected]}
              onPress={() => toggleLift(lift)}
              activeOpacity={0.7}
            >
              <Text style={[styles.liftChipText, selectedLifts.has(lift) && styles.liftChipTextSelected]}>
                {lift.charAt(0).toUpperCase() + lift.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.liftChip, allLifts && styles.liftChipSelected]}
            onPress={toggleAllLifts}
            activeOpacity={0.7}
          >
            <Text style={[styles.liftChipText, allLifts && styles.liftChipTextSelected]}>
              All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Unprogrammed event: event name + post-event soreness */}
        {isUnprogrammedEvent && (
          <>
            <SectionLabel label="Event name" />
            <TextInput
              style={styles.descriptionInput}
              value={eventName}
              onChangeText={setEventName}
              placeholder="e.g. Hyrox competition, local 5k race"
              placeholderTextColor={colors.textTertiary}
              returnKeyType="done"
            />

            <SectionLabel label="Post-event soreness" />
            {SORENESS_MUSCLES_DEFAULT.map((mg) => (
              <View key={mg.value} style={styles.sorenessRow}>
                <Text style={styles.sorenessMuscleLabel}>{mg.label}</Text>
                <View style={styles.sorenessChips}>
                  {SORENESS_CHIPS.map((chip) => {
                    const selected = (eventSoreness[mg.value] ?? 'none') === chip.value
                    return (
                      <TouchableOpacity
                        key={chip.value}
                        style={[styles.sorenessChip, selected && styles.sorenessChipSelected]}
                        onPress={() =>
                          setEventSoreness((prev) => ({ ...prev, [mg.value]: chip.value }))
                        }
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.sorenessChipText, selected && styles.sorenessChipTextSelected]}>
                          {chip.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Step 5: Description */}
        <SectionLabel label="5. More details (optional)" />
        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Left knee pain on descent, no pain on bench or deadlift"
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {submitError && (
          <Text style={styles.errorText}>{submitError}</Text>
        )}

        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Review Adjustments</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bgSurface },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgMuted,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 8 },

  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    marginBottom: 8,
  },

  // Type grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  typeCard: {
    width: '30%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  typeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  typeIcon: { fontSize: 20 },
  typeLabel: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  typeLabelSelected: { color: colors.primary, fontWeight: '600' },

  // Severity
  severityRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  severityButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  severityText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  // Date
  dateRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  dateField: { flex: 1 },
  dateFieldLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  datePill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  datePillText: {
    fontSize: 14,
    color: colors.text,
  },
  ongoingToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark: { fontSize: 12, color: colors.textInverse, fontWeight: '700' },
  ongoingLabel: { fontSize: 14, color: colors.textSecondary },

  // Lifts
  liftRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  liftChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  liftChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  liftChipText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  liftChipTextSelected: { color: colors.primary, fontWeight: '600' },

  // Description
  descriptionInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    minHeight: 96,
    marginBottom: 8,
  },

  errorText: { fontSize: 14, color: colors.danger, marginBottom: 8 },

  // Buttons
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: colors.textInverse },
  buttonDisabled: { opacity: 0.4 },

  // Review state
  noAdjustments: {
    padding: 20,
    backgroundColor: colors.successMuted,
    borderRadius: 12,
    marginBottom: 16,
  },
  noAdjustmentsText: { fontSize: 15, color: colors.success, textAlign: 'center', lineHeight: 22 },
  adjustmentSummaryHeader: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  adjustmentCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  adjustmentCount: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  adjustmentBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: colors.warningMuted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  adjustmentBadgeSkip: { backgroundColor: colors.dangerMuted },
  adjustmentBadgeText: { fontSize: 13, fontWeight: '600' as const, color: colors.textSecondary },
  adjustmentRationale: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  autoAppliedNote: {
    padding: 16,
    backgroundColor: colors.successMuted,
    borderRadius: 12,
    alignItems: 'center',
  },
  autoAppliedNoteText: { fontSize: 14, color: colors.success, fontWeight: '600', textAlign: 'center' },
  // Soreness
  sorenessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sorenessMuscleLabel: { fontSize: 13, color: colors.textSecondary, width: 90 },
  sorenessChips: { flexDirection: 'row', gap: 6, flex: 1 },
  sorenessChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  sorenessChipSelected: { borderColor: colors.warning, backgroundColor: colors.warningMuted },
  sorenessChipText: { fontSize: 11, color: colors.textTertiary },
  sorenessChipTextSelected: { color: colors.warning, fontWeight: '600' },
  reviewActions: { gap: 12, marginTop: 16 },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonText: { fontSize: 16, fontWeight: '600', color: colors.textInverse },
  skipButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
})
