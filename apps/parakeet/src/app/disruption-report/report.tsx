import { useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'

import { reportDisruption, applyDisruptionAdjustment } from '../../lib/disruptions'
import { useAuth } from '../../hooks/useAuth'
import type { DisruptionType, Severity, DisruptionWithSuggestions } from '@parakeet/shared-types'

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

const LIFTS = ['squat', 'bench', 'deadlift'] as const
type Lift = typeof LIFTS[number]

// ── Types ─────────────────────────────────────────────────────────────────────

type AdjustmentAction = 'weight_reduced' | 'session_skipped' | 'reps_reduced'

interface AdjSuggestion {
  session_id: string
  action: AdjustmentAction
  reduction_pct?: number
  reps_reduction?: number
  rationale?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })
}

function describeAction(suggestion: AdjSuggestion): string {
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

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>('form')
  const [disruption, setDisruption] = useState<DisruptionWithSuggestions | null>(null)

  // Form values
  const [selectedType, setSelectedType]     = useState<DisruptionType | null>(null)
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | null>(null)
  const [startDate, setStartDate]           = useState(todayIso())
  const [isOngoing, setIsOngoing]           = useState(false)
  const [endDate, setEndDate]               = useState('')
  const [selectedLifts, setSelectedLifts]   = useState<Set<Lift>>(new Set())
  const [allLifts, setAllLifts]             = useState(false)
  const [description, setDescription]       = useState('')

  // Loading states
  const [isSubmitting, setIsSubmitting]   = useState(false)
  const [isApplying, setIsApplying]       = useState(false)
  const [submitError, setSubmitError]     = useState<string | null>(null)

  // ── Handlers ────────────────────────────────────────────────────────────────

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
      setSelectedLifts(new Set(LIFTS))
    }
  }

  async function handleSubmit() {
    if (!selectedType || !selectedSeverity || !user) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const result = await reportDisruption(user.id, {
        disruption_type:    selectedType,
        severity:           selectedSeverity,
        affected_date_start: startDate,
        affected_date_end:  isOngoing ? undefined : (endDate || undefined),
        affected_lifts:     allLifts ? undefined : (selectedLifts.size > 0 ? Array.from(selectedLifts) : undefined),
        description:        description.trim() || undefined,
      })
      setDisruption(result)
      setScreenState('review')
    } catch {
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

  // ── Render: review state ─────────────────────────────────────────────────

  if (screenState === 'review' && disruption) {
    const suggestions = (disruption.suggested_adjustments ?? []) as AdjSuggestion[]
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Review Adjustments</Text>
          <Text style={styles.subtitle}>
            Based on your {disruption.disruption_type.replace(/_/g, ' ')} ({disruption.severity}), we suggest the following changes:
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
                No session adjustments needed — your upcoming sessions look fine.
              </Text>
            </View>
          ) : (
            suggestions.map((s, i) => (
              <View key={i} style={styles.adjustmentCard}>
                <View style={[
                  styles.adjustmentBadge,
                  s.action === 'session_skipped' && styles.adjustmentBadgeSkip,
                ]}>
                  <Text style={styles.adjustmentBadgeText}>{describeAction(s)}</Text>
                </View>
                {s.rationale ? (
                  <Text style={styles.adjustmentRationale}>{s.rationale}</Text>
                ) : null}
              </View>
            ))
          )}

          <View style={styles.reviewActions}>
            <TouchableOpacity
              style={[styles.applyButton, isApplying && styles.buttonDisabled]}
              onPress={handleApply}
              disabled={isApplying}
              activeOpacity={0.8}
            >
              {isApplying ? (
                <ActivityIndicator color="#fff" size="small" />
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
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Render: form state ───────────────────────────────────────────────────

  const canSubmit = !!selectedType && !!selectedSeverity && !isSubmitting

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
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
              style={[styles.typeCard, selectedType === t.value && styles.typeCardSelected]}
              onPress={() => setSelectedType(selectedType === t.value ? null : t.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.typeIcon}>{t.icon}</Text>
              <Text style={[styles.typeLabel, selectedType === t.value && styles.typeLabelSelected]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Step 2: Severity */}
        <SectionLabel label="2. How severe?" />
        <View style={styles.severityRow}>
          {(['minor', 'moderate', 'major'] as Severity[]).map((s) => {
            const colors = {
              minor:    { bg: '#FEF3C7', border: '#D97706', text: '#92400E' },
              moderate: { bg: '#FFEDD5', border: '#EA580C', text: '#7C2D12' },
              major:    { bg: '#FEE2E2', border: '#DC2626', text: '#7F1D1D' },
            }
            const c = colors[s]
            const selected = selectedSeverity === s
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.severityButton,
                  { borderColor: selected ? c.border : '#E5E7EB', backgroundColor: selected ? c.bg : '#fff' },
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

        {/* Step 3: Date range */}
        <SectionLabel label="3. When?" />
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateFieldLabel}>Start</Text>
            <TextInput
              style={styles.dateInput}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>
          {!isOngoing && (
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>End (optional)</Text>
              <TextInput
                style={styles.dateInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.ongoingToggle}
          onPress={() => setIsOngoing(!isOngoing)}
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
          {LIFTS.map((lift) => (
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

        {/* Step 5: Description */}
        <SectionLabel label="5. More details (optional)" />
        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Left knee pain on descent, no pain on bench or deadlift"
          placeholderTextColor="#9CA3AF"
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
            <ActivityIndicator color="#fff" size="small" />
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
  safeArea: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: { marginBottom: 8 },
  backText: { fontSize: 15, color: '#4F46E5', fontWeight: '500' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, lineHeight: 20 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 8 },

  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
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
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  typeCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  typeIcon: { fontSize: 20 },
  typeLabel: { fontSize: 12, color: '#374151', textAlign: 'center' },
  typeLabelSelected: { color: '#4F46E5', fontWeight: '600' },

  // Severity
  severityRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  severityButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  severityText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  // Date
  dateRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  dateField: { flex: 1 },
  dateFieldLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  dateInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  ongoingToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { borderColor: '#4F46E5', backgroundColor: '#4F46E5' },
  checkmark: { fontSize: 12, color: '#fff', fontWeight: '700' },
  ongoingLabel: { fontSize: 14, color: '#374151' },

  // Lifts
  liftRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  liftChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  liftChipSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  liftChipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  liftChipTextSelected: { color: '#4F46E5', fontWeight: '600' },

  // Description
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    minHeight: 96,
    marginBottom: 8,
  },

  errorText: { fontSize: 14, color: '#EF4444', marginBottom: 8 },

  // Buttons
  submitButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  buttonDisabled: { opacity: 0.4 },

  // Review state
  noAdjustments: {
    padding: 20,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    marginBottom: 16,
  },
  noAdjustmentsText: { fontSize: 15, color: '#15803D', textAlign: 'center', lineHeight: 22 },
  adjustmentCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    gap: 6,
  },
  adjustmentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  adjustmentBadgeSkip: { backgroundColor: '#FEE2E2' },
  adjustmentBadgeText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  adjustmentRationale: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  reviewActions: { gap: 12, marginTop: 16 },
  applyButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  skipButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: { fontSize: 15, fontWeight: '500', color: '#374151' },
})
