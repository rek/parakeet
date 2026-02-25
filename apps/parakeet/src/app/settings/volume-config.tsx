import { useState } from 'react'
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

import { DEFAULT_MRV_MEV_CONFIG_MALE, DEFAULT_MRV_MEV_CONFIG_FEMALE } from '@parakeet/training-engine'
import type { MrvMevConfig, MuscleGroup } from '@parakeet/training-engine'
import { getMrvMevConfig, updateMuscleConfig, resetMuscleToDefault } from '../../lib/volume-config'
import { getProfile } from '../../lib/profile'
import { useAuth } from '../../hooks/useAuth'

// ── Constants ─────────────────────────────────────────────────────────────────

const MUSCLES: MuscleGroup[] = [
  'quads', 'hamstrings', 'glutes', 'lower_back', 'upper_back',
  'chest', 'triceps', 'shoulders', 'biceps',
]

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  quads:      'Quads',
  hamstrings: 'Hamstrings',
  glutes:     'Glutes',
  lower_back: 'Lower Back',
  upper_back: 'Upper Back',
  chest:      'Chest',
  triceps:    'Triceps',
  shoulders:  'Shoulders',
  biceps:     'Biceps',
}

const MAX_MRV = 30

// ── Stepper ───────────────────────────────────────────────────────────────────

interface StepperProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}

function Stepper({ label, value, min, max, onChange }: StepperProps) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity
          style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          activeOpacity={0.7}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity
          style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]}
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          activeOpacity={0.7}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Muscle row ────────────────────────────────────────────────────────────────

interface MuscleRowProps {
  muscle: MuscleGroup
  mev: number
  mrv: number
  isDefault: boolean
  onMevChange: (v: number) => void
  onMrvChange: (v: number) => void
}

function MuscleRow({ muscle, mev, mrv, isDefault, onMevChange, onMrvChange }: MuscleRowProps) {
  const mrvError = mrv <= mev

  return (
    <View style={styles.muscleRow}>
      <View style={styles.muscleRowHeader}>
        <Text style={styles.muscleLabel}>{MUSCLE_LABELS[muscle]}</Text>
        {!isDefault && <View style={styles.customBadge}><Text style={styles.customBadgeText}>custom</Text></View>}
      </View>
      <View style={styles.stepperRow}>
        <Stepper label="MEV" value={mev} min={0} max={mrv - 1} onChange={onMevChange} />
        <Stepper label="MRV" value={mrv} min={mev + 1} max={MAX_MRV} onChange={onMrvChange} />
      </View>
      {mrvError && (
        <Text style={styles.errorText}>MRV must be greater than MEV</Text>
      )}
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

type Draft = Record<MuscleGroup, { mev: number; mrv: number }>

export default function VolumeConfigScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [sexDefaults, setSexDefaults] = useState<MrvMevConfig>(DEFAULT_MRV_MEV_CONFIG_MALE)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const { isLoading } = useQuery({
    queryKey: ['volume', 'config', user?.id],
    queryFn: async () => {
      const profile = await getProfile()
      const data = await getMrvMevConfig(user!.id, profile?.biological_sex)
      return { data, profile }
    },
    enabled: !!user?.id,
    onSuccess: ({ data, profile }) => {
      const defaults = profile?.biological_sex === 'female'
        ? DEFAULT_MRV_MEV_CONFIG_FEMALE
        : DEFAULT_MRV_MEV_CONFIG_MALE
      setSexDefaults(defaults)
      if (!draft) {
        setDraft(Object.fromEntries(
          MUSCLES.map((m) => [m, { mev: data[m].mev, mrv: data[m].mrv }]),
        ) as Draft)
      }
    },
  })

  function updateMuscle(muscle: MuscleGroup, field: 'mev' | 'mrv', value: number) {
    setDraft((prev) => prev ? { ...prev, [muscle]: { ...prev[muscle], [field]: value } } : prev)
  }

  function isDefaultValue(muscle: MuscleGroup): boolean {
    if (!draft) return true
    const d = sexDefaults[muscle]
    return draft[muscle].mev === d.mev && draft[muscle].mrv === d.mrv
  }

  async function handleSave() {
    if (!draft || !user) return
    setIsSaving(true)
    try {
      await Promise.all(
        MUSCLES.map((m) => updateMuscleConfig(user.id, m, draft[m]))
      )
      queryClient.invalidateQueries({ queryKey: ['volume'] })
      router.back()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleResetAll() {
    if (!user) return
    setIsResetting(true)
    try {
      await Promise.all(MUSCLES.map((m) => resetMuscleToDefault(user.id, m)))
      setDraft(Object.fromEntries(
        MUSCLES.map((m) => [m, { ...sexDefaults[m] }]),
      ) as Draft)
      queryClient.invalidateQueries({ queryKey: ['volume'] })
    } finally {
      setIsResetting(false)
    }
  }

  const hasErrors = draft
    ? MUSCLES.some((m) => draft[m].mrv <= draft[m].mev)
    : false

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Volume Config</Text>
          <TouchableOpacity
            style={[styles.saveButton, (hasErrors || isSaving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={hasErrors || isSaving}
            activeOpacity={0.8}
          >
            {isSaving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveButtonText}>Save</Text>
            }
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          MEV = minimum effective volume · MRV = maximum recoverable volume (sets/week)
        </Text>
      </View>

      {isLoading || !draft ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#4F46E5" size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {MUSCLES.map((muscle) => (
            <MuscleRow
              key={muscle}
              muscle={muscle}
              mev={draft[muscle].mev}
              mrv={draft[muscle].mrv}
              isDefault={isDefaultValue(muscle)}
              onMevChange={(v) => updateMuscle(muscle, 'mev', v)}
              onMrvChange={(v) => updateMuscle(muscle, 'mrv', v)}
            />
          ))}

          <TouchableOpacity
            style={[styles.resetButton, isResetting && styles.resetButtonDisabled]}
            onPress={handleResetAll}
            disabled={isResetting}
            activeOpacity={0.7}
          >
            {isResetting
              ? <ActivityIndicator color="#6B7280" size="small" />
              : <Text style={styles.resetButtonText}>Reset All to Research Defaults</Text>
            }
          </TouchableOpacity>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 4,
  },
  backButton: { marginBottom: 4 },
  backText: { fontSize: 15, color: '#4F46E5', fontWeight: '500' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#9CA3AF', lineHeight: 16 },
  saveButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 2 },

  muscleRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  muscleRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muscleLabel: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  customBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  customBadgeText: { fontSize: 10, fontWeight: '600', color: '#4F46E5' },
  stepperRow: { flexDirection: 'row', gap: 24 },
  errorText: { fontSize: 12, color: '#EF4444' },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperLabel: { fontSize: 13, color: '#6B7280', width: 32 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: { fontSize: 18, color: '#374151', lineHeight: 22 },
  stepperValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    width: 28,
    textAlign: 'center',
  },

  resetButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  resetButtonDisabled: { opacity: 0.5 },
  resetButtonText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
})
