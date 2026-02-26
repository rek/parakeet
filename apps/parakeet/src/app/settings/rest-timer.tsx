import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { IntensityType } from '@parakeet/shared-types'
import { getUserRestOverrides, setRestOverride, resetRestOverrides } from '../../lib/rest-config'
import { getRestTimerPrefs, setRestTimerPrefs } from '../../lib/settings'
import type { RestTimerPrefs } from '../../lib/settings'
import { useAuth } from '../../hooks/useAuth'

// ── Constants ─────────────────────────────────────────────────────────────────

// Intensity-type duration rows in display order
const INTENSITY_ROWS: { type: IntensityType; label: string; defaultSeconds: number }[] = [
  { type: 'heavy',     label: 'Heavy sets',     defaultSeconds: 180 },
  { type: 'explosive', label: 'Explosive sets',  defaultSeconds: 150 },
  { type: 'rep',       label: 'Rep sets',        defaultSeconds: 120 },
  { type: 'deload',    label: 'Deload sets',     defaultSeconds:  90 },
]

// Auxiliary row shown in its own section
const AUXILIARY_DEFAULT_SECONDS = 90

// Picker options
const MINUTE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const SECOND_OPTIONS = [0, 15, 30, 45]

const MIN_SECONDS = 30
const MAX_SECONDS = 600

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (s === 0) return `${m} min`
  return `${m} min ${s} s`
}

function clampSeconds(minutes: number, seconds: number): number {
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, minutes * 60 + seconds))
}

// ── Duration row with inline picker ──────────────────────────────────────────

interface DurationRowProps {
  label: string
  totalSeconds: number
  isOpen: boolean
  isSaving: boolean
  onToggle: () => void
  onConfirm: (seconds: number) => void
}

function DurationRow({ label, totalSeconds, isOpen, isSaving, onToggle, onConfirm }: DurationRowProps) {
  const currentMinutes = Math.floor(totalSeconds / 60)
  const currentSeconds = totalSeconds % 60

  const [draftMinutes, setDraftMinutes] = useState(currentMinutes)
  const [draftSeconds, setDraftSeconds] = useState(currentSeconds)

  // Sync draft when the row opens (value may have changed elsewhere)
  useEffect(() => {
    if (isOpen) {
      setDraftMinutes(Math.floor(totalSeconds / 60))
      setDraftSeconds(totalSeconds % 60)
    }
  }, [isOpen, totalSeconds])

  const draftTotal = clampSeconds(draftMinutes, draftSeconds)

  return (
    <View>
      <TouchableOpacity
        style={styles.durationRow}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.durationRowLabel}>{label}</Text>
        <View style={styles.durationRowRight}>
          {isSaving
            ? <ActivityIndicator size="small" color="#4F46E5" />
            : <Text style={styles.durationValue}>{formatDuration(totalSeconds)}</Text>
          }
          <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>›</Text>
        </View>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.pickerContainer}>
          {/* Minutes picker */}
          <View style={styles.pickerColumn}>
            <Text style={styles.pickerColumnLabel}>min</Text>
            <ScrollView
              style={styles.pickerScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.pickerScrollContent}
            >
              {MINUTE_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerItem, draftMinutes === m && styles.pickerItemSelected]}
                  onPress={() => setDraftMinutes(m)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerItemText, draftMinutes === m && styles.pickerItemTextSelected]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Seconds picker */}
          <View style={styles.pickerColumn}>
            <Text style={styles.pickerColumnLabel}>sec</Text>
            <ScrollView
              style={styles.pickerScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.pickerScrollContent}
            >
              {SECOND_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.pickerItem, draftSeconds === s && styles.pickerItemSelected]}
                  onPress={() => setDraftSeconds(s)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerItemText, draftSeconds === s && styles.pickerItemTextSelected]}>
                    {String(s).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Confirm */}
          <View style={styles.pickerConfirmColumn}>
            <Text style={styles.pickerPreviewText}>{formatDuration(draftTotal)}</Text>
            {draftTotal < MIN_SECONDS && (
              <Text style={styles.pickerWarning}>min {formatDuration(MIN_SECONDS)}</Text>
            )}
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => onConfirm(draftTotal)}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmButtonText}>Set</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

// ── Preview card ──────────────────────────────────────────────────────────────

interface PreviewCardProps {
  heavySeconds: number
}

function PreviewCard({ heavySeconds }: PreviewCardProps) {
  const minutes = Math.floor(heavySeconds / 60)
  const seconds = heavySeconds % 60
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`

  return (
    <View style={styles.preview}>
      <Text style={styles.previewTitle}>Preview — Block 2 · Heavy Squat</Text>
      <Text style={styles.previewBody}>
        {'Rest timer will start at  '}
        <Text style={styles.previewTime}>{timeStr}</Text>
        {'  after each set'}
      </Text>
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RestTimerSettingsScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Map intensityType → seconds (null = use default)
  const [durations, setDurations] = useState<Partial<Record<IntensityType | 'auxiliary', number>>>({})
  // Which row's picker is open (null = none)
  const [openRow, setOpenRow] = useState<IntensityType | 'auxiliary' | null>(null)
  // Per-row saving indicator
  const [saving, setSaving] = useState<Partial<Record<IntensityType | 'auxiliary', boolean>>>({})
  // Alert/pref toggles
  const [prefs, setPrefs] = useState<RestTimerPrefs>({
    audioAlert: true,
    hapticAlert: true,
    llmSuggestions: true,
  })
  const [resetting, setResetting] = useState(false)

  // Load existing overrides from Supabase
  const { isLoading } = useQuery({
    queryKey: ['rest', 'overrides', user?.id],
    queryFn: () => getUserRestOverrides(user!.id),
    enabled: !!user?.id,
    onSuccess: (data) => {
      const map: Partial<Record<IntensityType | 'auxiliary', number>> = {}
      for (const row of data) {
        if (row.lift == null && row.intensityType != null) {
          map[row.intensityType] = row.restSeconds
        }
        // auxiliary: lift=null, intensityType=null catch-all not used here;
        // the spec writes lift=NULL rows keyed by intensityType only.
        // For auxiliary section we look for a row with no intensityType and no lift.
        if (row.lift == null && row.intensityType == null) {
          map['auxiliary'] = row.restSeconds
        }
      }
      setDurations(map)
    },
  })

  // Load device-local prefs
  useEffect(() => {
    getRestTimerPrefs().then(setPrefs)
  }, [])

  function getSeconds(key: IntensityType | 'auxiliary'): number {
    if (durations[key] != null) return durations[key] as number
    if (key === 'auxiliary') return AUXILIARY_DEFAULT_SECONDS
    const row = INTENSITY_ROWS.find((r) => r.type === key)
    return row?.defaultSeconds ?? 120
  }

  async function handleConfirm(key: IntensityType | 'auxiliary', seconds: number) {
    if (!user) return
    setSaving((prev) => ({ ...prev, [key]: true }))
    setOpenRow(null)
    try {
      if (key === 'auxiliary') {
        // catch-all row: no lift, no intensityType
        await setRestOverride(user.id, seconds, undefined, undefined)
      } else {
        await setRestOverride(user.id, seconds, undefined, key)
      }
      setDurations((prev) => ({ ...prev, [key]: seconds }))
      queryClient.invalidateQueries({ queryKey: ['rest', 'overrides'] })
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }))
    }
  }

  async function handleReset() {
    if (!user) return
    setResetting(true)
    try {
      await resetRestOverrides(user.id)
      setDurations({})
      queryClient.invalidateQueries({ queryKey: ['rest', 'overrides'] })
    } finally {
      setResetting(false)
    }
  }

  async function handleTogglePref(key: keyof RestTimerPrefs, value: boolean) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    await setRestTimerPrefs({ [key]: value })
  }

  function toggleRow(key: IntensityType | 'auxiliary') {
    setOpenRow((prev) => (prev === key ? null : key))
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Rest Timer</Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#4F46E5" size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Rest Durations section ─────────────────────────────────────── */}
          <Text style={styles.sectionHeader}>Rest Durations</Text>
          <View style={styles.card}>
            {INTENSITY_ROWS.map((row, i) => (
              <View key={row.type}>
                <DurationRow
                  label={row.label}
                  totalSeconds={getSeconds(row.type)}
                  isOpen={openRow === row.type}
                  isSaving={!!saving[row.type]}
                  onToggle={() => toggleRow(row.type)}
                  onConfirm={(s) => handleConfirm(row.type, s)}
                />
                {i < INTENSITY_ROWS.length - 1 && <View style={styles.separator} />}
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.resetButton, resetting && styles.resetButtonDisabled]}
            onPress={handleReset}
            disabled={resetting}
            activeOpacity={0.8}
          >
            {resetting
              ? <ActivityIndicator size="small" color="#6B7280" />
              : <Text style={styles.resetButtonText}>Reset to defaults</Text>
            }
          </TouchableOpacity>

          {/* ── Auxiliary section ──────────────────────────────────────────── */}
          <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>Auxiliary</Text>
          <View style={styles.card}>
            <DurationRow
              label="Auxiliary sets"
              totalSeconds={getSeconds('auxiliary')}
              isOpen={openRow === 'auxiliary'}
              isSaving={!!saving['auxiliary']}
              onToggle={() => toggleRow('auxiliary')}
              onConfirm={(s) => handleConfirm('auxiliary', s)}
            />
          </View>

          {/* ── Alerts section ─────────────────────────────────────────────── */}
          <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>Alerts</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Audio alert at 0:00</Text>
              <Switch
                value={prefs.audioAlert}
                onValueChange={(v) => handleTogglePref('audioAlert', v)}
                trackColor={{ true: '#4F46E5' }}
              />
            </View>
            <View style={styles.separator} />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Haptic alert at 0:00</Text>
              <Switch
                value={prefs.hapticAlert}
                onValueChange={(v) => handleTogglePref('hapticAlert', v)}
                trackColor={{ true: '#4F46E5' }}
              />
            </View>
            <View style={styles.separator} />
            <View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>AI rest suggestions</Text>
                <Switch
                  value={prefs.llmSuggestions}
                  onValueChange={(v) => handleTogglePref('llmSuggestions', v)}
                  trackColor={{ true: '#4F46E5' }}
                />
              </View>
              <Text style={styles.toggleSubtext}>Requires AI workout generation</Text>
            </View>
          </View>

          {/* ── Live preview ───────────────────────────────────────────────── */}
          <PreviewCard heavySeconds={getSeconds('heavy')} />
        </ScrollView>
      )}
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
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 20 },

  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionHeaderSpaced: { marginTop: 24 },

  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },

  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },

  // Duration row
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  durationRowLabel: { flex: 1, fontSize: 16, color: '#111827' },
  durationRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  durationValue: { fontSize: 15, color: '#4F46E5', fontWeight: '500' },
  chevron: { fontSize: 20, color: '#9CA3AF', lineHeight: 22, transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '270deg' }] },

  // Inline picker
  pickerContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  pickerColumn: { alignItems: 'center', gap: 4 },
  pickerColumnLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase' },
  pickerScroll: { maxHeight: 152 },
  pickerScrollContent: { gap: 2 },
  pickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  pickerItemSelected: { backgroundColor: '#EEF2FF' },
  pickerItemText: { fontSize: 17, fontWeight: '500', color: '#374151', textAlign: 'center' },
  pickerItemTextSelected: { color: '#4F46E5', fontWeight: '700' },

  pickerConfirmColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 24,
  },
  pickerPreviewText: { fontSize: 18, fontWeight: '700', color: '#111827' },
  pickerWarning: { fontSize: 11, color: '#EF4444' },
  confirmButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 9,
  },
  confirmButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Reset button
  resetButton: {
    marginTop: 10,
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minWidth: 64,
    alignItems: 'center',
  },
  resetButtonDisabled: { opacity: 0.4 },
  resetButtonText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleLabel: { flex: 1, fontSize: 16, color: '#111827' },
  toggleSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginTop: -8,
  },

  // Preview card
  preview: {
    marginTop: 24,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  previewTitle: { fontSize: 11, color: '#16A34A', fontWeight: '600' },
  previewBody: { fontSize: 14, color: '#15803D', lineHeight: 20 },
  previewTime: { fontWeight: '700' },
})
