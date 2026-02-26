import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { getJITStrategyOverride, setJITStrategyOverride } from '../../lib/settings'
import type { JITStrategyOverride } from '../../lib/settings'
import {
  getDeveloperSuggestions,
  updateSuggestionStatus,
} from '../../lib/developer-suggestions'
import type { DeveloperSuggestion } from '../../lib/developer-suggestions'

// ── Constants ─────────────────────────────────────────────────────────────────

interface StrategyOption {
  value: JITStrategyOverride
  label: string
  description: string
}

const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'LLM when online, formula when offline',
  },
  {
    value: 'formula',
    label: 'Formula only',
    description: 'Deterministic rule-based — always offline',
  },
  {
    value: 'llm',
    label: 'LLM only',
    description: 'AI-generated — requires network',
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Runs both in parallel; shows comparison in session',
  },
]

// ── Cycle Feedback sub-components ─────────────────────────────────────────────

interface PriorityBadgeProps {
  priority: DeveloperSuggestion['priority']
}

function PriorityBadge({ priority }: PriorityBadgeProps) {
  const color =
    priority === 'high' ? '#EF4444' : priority === 'medium' ? '#F59E0B' : '#9CA3AF'
  const bg =
    priority === 'high' ? '#FEF2F2' : priority === 'medium' ? '#FFFBEB' : '#F3F4F6'
  return (
    <View style={[styles.priorityBadge, { backgroundColor: bg }]}>
      <Text style={[styles.priorityBadgeText, { color }]}>{priority.toUpperCase()}</Text>
    </View>
  )
}

interface SuggestionCardProps {
  suggestion: DeveloperSuggestion
  onAcknowledge: () => void
  onDismiss: () => void
  isUpdating: boolean
}

function SuggestionCard({ suggestion, onAcknowledge, onDismiss, isUpdating }: SuggestionCardProps) {
  return (
    <View style={styles.suggestionCard}>
      <View style={styles.suggestionCardHeader}>
        <PriorityBadge priority={suggestion.priority} />
        <Text style={styles.suggestionDate}>
          {new Date(suggestion.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
      <Text style={styles.suggestionRationale}>{suggestion.rationale}</Text>
      <View style={styles.devNoteContainer}>
        <Text style={styles.devNoteLabel}>Dev note</Text>
        <Text style={styles.devNoteText}>{suggestion.developer_note}</Text>
      </View>
      {isUpdating ? (
        <View style={styles.suggestionActions}>
          <ActivityIndicator color="#4F46E5" size="small" />
        </View>
      ) : (
        <View style={styles.suggestionActions}>
          <TouchableOpacity
            style={styles.acknowledgeBtn}
            onPress={onAcknowledge}
            activeOpacity={0.7}
          >
            <Text style={styles.acknowledgeBtnText}>Acknowledge</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissBtnText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ── JIT Strategy sub-components ────────────────────────────────────────────────

interface StrategyRowProps {
  option: StrategyOption
  selected: boolean
  onPress: () => void
}

function StrategyRow({ option, selected, onPress }: StrategyRowProps) {
  return (
    <TouchableOpacity
      style={[styles.strategyRow, selected && styles.strategyRowSelected]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={styles.strategyRadio}>
        {selected && <View style={styles.strategyRadioInner} />}
      </View>
      <View style={styles.strategyText}>
        <Text style={[styles.strategyLabel, selected && styles.strategyLabelSelected]}>
          {option.label}
        </Text>
        <Text style={styles.strategyDescription}>{option.description}</Text>
      </View>
    </TouchableOpacity>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DeveloperSettingsScreen() {
  const [strategy, setStrategy] = useState<JITStrategyOverride>('auto')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    getJITStrategyOverride()
      .then(setStrategy)
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = useCallback(
    async (value: JITStrategyOverride) => {
      if (saving || value === strategy) return
      setSaving(true)
      setStrategy(value)
      try {
        await setJITStrategyOverride(value)
      } finally {
        setSaving(false)
      }
    },
    [saving, strategy],
  )

  const { data: suggestions = [] } = useQuery({
    queryKey: ['developer', 'suggestions'],
    queryFn: getDeveloperSuggestions,
    staleTime: 30 * 1000,
  })

  const unreviewed = suggestions.filter((s) => s.status === 'unreviewed')
  const reviewed = suggestions.filter((s) => s.status !== 'unreviewed')
  const acknowledgedCount = reviewed.filter((s) => s.status === 'acknowledged').length
  const implementedCount = reviewed.filter((s) => s.status === 'implemented').length
  const dismissedCount = reviewed.filter((s) => s.status === 'dismissed').length

  async function handleUpdateSuggestion(
    id: string,
    status: 'acknowledged' | 'implemented' | 'dismissed',
  ) {
    setUpdatingId(id)
    try {
      await updateSuggestionStatus(id, status)
      queryClient.invalidateQueries({ queryKey: ['developer', 'suggestions'] })
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backLabel}>‹ Settings</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.screenTitle}>Developer</Text>
        <Text style={styles.screenSubtitle}>
          Options for testing and debugging the training engine.
        </Text>

        <View style={styles.divider} />

        {/* JIT Strategy section */}
        <Text style={styles.sectionHeader}>JIT Strategy</Text>
        <Text style={styles.sectionNote}>
          Override which generator produces planned sets at session start.
          Changes take effect on the next session generation.
        </Text>

        {loading ? (
          <ActivityIndicator style={styles.loader} color="#111827" />
        ) : (
          <View style={styles.strategyList}>
            {STRATEGY_OPTIONS.map((option) => (
              <StrategyRow
                key={option.value}
                option={option}
                selected={strategy === option.value}
                onPress={() => void handleSelect(option.value)}
              />
            ))}
          </View>
        )}

        {saving && (
          <Text style={styles.savingLabel}>Saving...</Text>
        )}

        <View style={styles.divider} />

        {/* Cycle Feedback section */}
        <View style={styles.cycleFeedbackHeader}>
          <Text style={styles.sectionHeader}>Cycle Feedback</Text>
          {unreviewed.length > 0 && (
            <View style={styles.unreviewedBadge}>
              <Text style={styles.unreviewedBadgeText}>{unreviewed.length} unreviewed</Text>
            </View>
          )}
        </View>
        <Text style={styles.sectionNote}>
          Structural suggestions from cycle review analysis that require code changes.
        </Text>

        {unreviewed.length === 0 && (
          <Text style={styles.emptyText}>No unreviewed suggestions.</Text>
        )}

        <View style={styles.suggestionList}>
          {unreviewed.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              isUpdating={updatingId === s.id}
              onAcknowledge={() => void handleUpdateSuggestion(s.id, 'acknowledged')}
              onDismiss={() => void handleUpdateSuggestion(s.id, 'dismissed')}
            />
          ))}
        </View>

        {reviewed.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.historySummaryRow}
              onPress={() => setShowHistory((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.historySummaryText}>
                {[
                  acknowledgedCount > 0 ? `Acknowledged (${acknowledgedCount})` : null,
                  implementedCount > 0 ? `Implemented (${implementedCount})` : null,
                  dismissedCount > 0 ? `Dismissed (${dismissedCount})` : null,
                ]
                  .filter(Boolean)
                  .join('  ')}
              </Text>
              <Text style={styles.historyChevron}>{showHistory ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showHistory &&
              reviewed.map((s) => (
                <View key={s.id} style={styles.historyCard}>
                  <View style={styles.historyCardHeader}>
                    <PriorityBadge priority={s.priority} />
                    <Text style={styles.historyStatus}>{s.status}</Text>
                  </View>
                  <Text style={styles.historyDescription}>{s.description}</Text>
                  {s.reviewed_at && (
                    <Text style={styles.historyDate}>
                      {new Date(s.reviewed_at).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 8,
  },
  backBtn: {
    paddingVertical: 4,
  },
  backLabel: {
    fontSize: 16,
    color: '#6b7280',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  screenSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionNote: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 16,
    lineHeight: 18,
  },
  strategyList: {
    gap: 8,
  },
  strategyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  strategyRowSelected: {
    borderColor: '#111827',
    backgroundColor: '#F9FAFB',
  },
  strategyRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strategyRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111827',
  },
  strategyText: {
    flex: 1,
  },
  strategyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
  },
  strategyLabelSelected: {
    color: '#111827',
  },
  strategyDescription: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
  },
  loader: {
    marginTop: 24,
  },
  savingLabel: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
  },

  // Cycle Feedback section
  cycleFeedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  unreviewedBadge: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  unreviewedBadgeText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  emptyText: { fontSize: 14, color: '#9CA3AF', paddingVertical: 8 },
  suggestionList: { gap: 12 },

  // Suggestion card
  suggestionCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    backgroundColor: '#FAFAFA',
  },
  suggestionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionDate: { fontSize: 11, color: '#9CA3AF' },
  suggestionDescription: { fontSize: 15, fontWeight: '600', color: '#111827', lineHeight: 20 },
  suggestionRationale: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  devNoteContainer: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  devNoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devNoteText: { fontSize: 13, color: '#3730A3', lineHeight: 18 },
  suggestionActions: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  acknowledgeBtn: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  acknowledgeBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  dismissBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  dismissBtnText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },

  // Priority badge
  priorityBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  priorityBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // History
  historySummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 4,
  },
  historySummaryText: { fontSize: 13, color: '#6B7280' },
  historyChevron: { fontSize: 11, color: '#9CA3AF' },
  historyCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    gap: 4,
    marginTop: 4,
  },
  historyCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyStatus: { fontSize: 11, color: '#6B7280', textTransform: 'capitalize' },
  historyDescription: { fontSize: 13, color: '#374151' },
  historyDate: { fontSize: 11, color: '#9CA3AF' },
})
