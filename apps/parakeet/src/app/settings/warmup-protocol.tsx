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
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  generateWarmupSets,
  getPresetSteps,
} from '@parakeet/training-engine'
import type { WarmupPresetName, WarmupProtocol, WarmupStep } from '@parakeet/training-engine'
import type { Lift } from '@parakeet/shared-types'
import { getAllWarmupConfigs, updateWarmupConfig } from '../../lib/warmup-config'
import { getCurrentOneRmKg } from '../../lib/lifter-maxes'
import { useAuth } from '../../hooks/useAuth'

// ── Constants ─────────────────────────────────────────────────────────────────

const LIFTS: Lift[] = ['squat', 'bench', 'deadlift']

const LIFT_LABELS: Record<Lift, string> = {
  squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift',
}

const PRESETS: { name: WarmupPresetName; label: string; description: string }[] = [
  { name: 'standard',  label: 'Standard',       description: '4 sets — 40/60/75/90%' },
  { name: 'minimal',   label: 'Minimal',         description: '2 sets — 50/75%' },
  { name: 'extended',  label: 'Extended',        description: '6 sets — 30/50/65/80/90/95%' },
  { name: 'empty_bar', label: 'Empty Bar First', description: '4 sets — bar/50/70/85%' },
]

// Working weight estimate: 80% of 1RM is representative for a heavy block
const WORKING_PCT = 0.80

// ── Custom step editor ────────────────────────────────────────────────────────

interface CustomStepEditorProps {
  steps: WarmupStep[]
  onChange: (steps: WarmupStep[]) => void
}

function CustomStepEditor({ steps, onChange }: CustomStepEditorProps) {
  function updateStep(i: number, field: keyof WarmupStep, raw: string) {
    const value = parseInt(raw, 10)
    if (isNaN(value)) return
    const next = steps.map((s, idx) =>
      idx === i ? { ...s, [field]: field === 'pct' ? value / 100 : value } : s,
    )
    onChange(next)
  }

  function addStep() {
    const lastPct = steps.length > 0 ? steps[steps.length - 1].pct : 0.5
    onChange([...steps, { pct: Math.min(0.99, lastPct + 0.1), reps: 3 }])
  }

  function removeStep(i: number) {
    onChange(steps.filter((_, idx) => idx !== i))
  }

  return (
    <View style={styles.customEditor}>
      <Text style={styles.customEditorTitle}>Custom Steps</Text>
      {steps.map((step, i) => (
        <View key={i} style={styles.customStep}>
          <View style={styles.customStepField}>
            <Text style={styles.customStepLabel}>%</Text>
            <TextInput
              style={styles.customStepInput}
              value={String(Math.round(step.pct * 100))}
              onChangeText={(v) => updateStep(i, 'pct', v)}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <Text style={styles.customStepSep}>×</Text>
          <View style={styles.customStepField}>
            <Text style={styles.customStepLabel}>reps</Text>
            <TextInput
              style={styles.customStepInput}
              value={String(step.reps)}
              onChangeText={(v) => updateStep(i, 'reps', v)}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <TouchableOpacity
            style={styles.removeStep}
            onPress={() => removeStep(i)}
            activeOpacity={0.7}
          >
            <Text style={styles.removeStepText}>−</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.addStep} onPress={addStep} activeOpacity={0.7}>
        <Text style={styles.addStepText}>+ Add Step</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Warmup preview ────────────────────────────────────────────────────────────

interface WarmupPreviewProps {
  protocol: WarmupProtocol
  oneRmKg: number
  lift: Lift
}

function WarmupPreview({ protocol, oneRmKg, lift }: WarmupPreviewProps) {
  if (!oneRmKg) return null
  const workingWeight = Math.round(oneRmKg * WORKING_PCT * 2) / 2
  const sets = generateWarmupSets(workingWeight, protocol)

  return (
    <View style={styles.preview}>
      <Text style={styles.previewTitle}>
        Preview ({lift} {oneRmKg}kg 1RM, ~{workingWeight}kg working)
      </Text>
      <Text style={styles.previewSets}>
        {sets.map((s) => `${s.displayWeight}×${s.reps}`).join(' → ')}
      </Text>
    </View>
  )
}

// ── Lift section ──────────────────────────────────────────────────────────────

interface LiftSectionProps {
  lift: Lift
  protocol: WarmupProtocol
  oneRmKg: number
  isSaving: boolean
  onChange: (p: WarmupProtocol) => void
  onSave: () => void
}

function LiftSection({ lift, protocol, oneRmKg, isSaving, onChange, onSave }: LiftSectionProps) {
  const selectedPreset = protocol.type === 'preset' ? protocol.name : null

  return (
    <View style={styles.liftSection}>
      <View style={styles.liftSectionHeader}>
        <Text style={styles.liftSectionTitle}>{LIFT_LABELS[lift]}</Text>
        <TouchableOpacity
          style={[styles.saveLiftButton, isSaving && styles.saveLiftButtonDisabled]}
          onPress={onSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveLiftButtonText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Preset picker */}
      <View style={styles.presetGrid}>
        {PRESETS.map((p) => (
          <TouchableOpacity
            key={p.name}
            style={[styles.presetCard, selectedPreset === p.name && styles.presetCardSelected]}
            onPress={() => onChange({ type: 'preset', name: p.name })}
            activeOpacity={0.7}
          >
            <Text style={[styles.presetLabel, selectedPreset === p.name && styles.presetLabelSelected]}>
              {p.label}
            </Text>
            <Text style={styles.presetDescription}>{p.description}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.presetCard, protocol.type === 'custom' && styles.presetCardSelected]}
          onPress={() => onChange({
            type: 'custom',
            steps: protocol.type === 'custom'
              ? protocol.steps
              : getPresetSteps('standard'),
          })}
          activeOpacity={0.7}
        >
          <Text style={[styles.presetLabel, protocol.type === 'custom' && styles.presetLabelSelected]}>
            Custom
          </Text>
          <Text style={styles.presetDescription}>Define your own steps</Text>
        </TouchableOpacity>
      </View>

      {/* Custom editor */}
      {protocol.type === 'custom' && (
        <CustomStepEditor
          steps={protocol.steps}
          onChange={(steps) => onChange({ type: 'custom', steps })}
        />
      )}

      {/* Preview */}
      <WarmupPreview protocol={protocol} oneRmKg={oneRmKg} lift={lift} />
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WarmupProtocolScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [protocols, setProtocols] = useState<Record<Lift, WarmupProtocol> | null>(null)
  const [saving, setSaving] = useState<Partial<Record<Lift, boolean>>>({})

  const { isLoading } = useQuery({
    queryKey: ['warmup', 'configs', user?.id],
    queryFn: () => getAllWarmupConfigs(user!.id),
    enabled: !!user?.id,
    onSuccess: (data) => {
      if (!protocols) setProtocols(data)
    },
  })

  const { data: maxes } = useQuery({
    queryKey: ['maxes', 'all', user?.id],
    queryFn: async () => {
      const [squat, bench, deadlift] = await Promise.all([
        getCurrentOneRmKg(user!.id, 'squat'),
        getCurrentOneRmKg(user!.id, 'bench'),
        getCurrentOneRmKg(user!.id, 'deadlift'),
      ])
      return { squat: squat ?? 0, bench: bench ?? 0, deadlift: deadlift ?? 0 }
    },
    enabled: !!user?.id,
  })

  async function handleSaveLift(lift: Lift) {
    if (!protocols || !user) return
    setSaving((prev) => ({ ...prev, [lift]: true }))
    try {
      await updateWarmupConfig(user.id, lift, protocols[lift])
      queryClient.invalidateQueries({ queryKey: ['warmup'] })
    } finally {
      setSaving((prev) => ({ ...prev, [lift]: false }))
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Warmup Protocol</Text>
      </View>

      {isLoading || !protocols ? (
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
          {LIFTS.map((lift) => (
            <LiftSection
              key={lift}
              lift={lift}
              protocol={protocols[lift]}
              oneRmKg={maxes?.[lift] ?? 0}
              isSaving={!!saving[lift]}
              onChange={(p) => setProtocols((prev) => prev ? { ...prev, [lift]: p } : prev)}
              onSave={() => handleSaveLift(lift)}
            />
          ))}
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
  content: { paddingBottom: 48 },

  liftSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  liftSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liftSectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  saveLiftButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  saveLiftButtonDisabled: { opacity: 0.4 },
  saveLiftButtonText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  presetGrid: { gap: 8 },
  presetCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  presetCardSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  presetLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  presetLabelSelected: { color: '#4F46E5' },
  presetDescription: { fontSize: 12, color: '#9CA3AF' },

  // Custom editor
  customEditor: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  customEditorTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  customStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customStepField: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  customStepLabel: { fontSize: 12, color: '#6B7280', width: 28 },
  customStepInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    color: '#111827',
    width: 48,
    textAlign: 'center',
  },
  customStepSep: { fontSize: 16, color: '#6B7280' },
  removeStep: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  removeStepText: { fontSize: 18, color: '#EF4444', lineHeight: 22 },
  addStep: {
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  addStepText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  // Preview
  preview: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  previewTitle: { fontSize: 11, color: '#16A34A', fontWeight: '600' },
  previewSets: { fontSize: 13, color: '#15803D', lineHeight: 18 },
})
