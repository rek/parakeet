import { useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { estimateOneRepMax_Epley } from '@parakeet/training-engine'
import { colors } from '../../../theme'

// ── Types ────────────────────────────────────────────────────────────────────

interface LiftState {
  type: '1rm' | '3rm'
  weightKg: string
  reps: string
}

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

type LiftKey = 'squat' | 'bench' | 'deadlift'

const LIFT_LABELS: Record<LiftKey, string> = {
  squat: 'Squat',
  bench: 'Bench Press',
  deadlift: 'Deadlift',
}

const LIFT_ORDER: LiftKey[] = ['squat', 'bench', 'deadlift']

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDefaultState(): LiftState {
  return { type: '3rm', weightKg: '', reps: '3' }
}

function computeEstimated1RM(state: LiftState): string {
  const weight = parseFloat(state.weightKg)
  if (!weight || weight <= 0) return '—'

  if (state.type === '1rm') {
    return weight.toFixed(1) + ' kg'
  }

  const reps = parseInt(state.reps, 10)
  if (!reps || reps < 2 || reps > 10) return '—'

  try {
    const estimated = estimateOneRepMax_Epley(weight, reps)
    return estimated.toFixed(1) + ' kg'
  } catch {
    return '—'
  }
}

function isLiftValid(state: LiftState): boolean {
  const weight = parseFloat(state.weightKg)
  if (!weight || weight <= 0) return false
  if (state.type === '3rm') {
    const reps = parseInt(state.reps, 10)
    if (!reps || reps < 2 || reps > 10) return false
  }
  return true
}

function buildLiftInput(state: LiftState): LiftInput {
  const weight = parseFloat(state.weightKg)
  if (state.type === '1rm') {
    return { type: '1rm', weightKg: weight }
  }
  return { type: '3rm', weightKg: weight, reps: parseInt(state.reps, 10) }
}

// ── Sub-component: single lift section ──────────────────────────────────────

interface LiftSectionProps {
  liftKey: LiftKey
  state: LiftState
  onChange: (key: LiftKey, update: Partial<LiftState>) => void
}

function LiftSection({ liftKey, state, onChange }: LiftSectionProps) {
  const estimated = computeEstimated1RM(state)

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{LIFT_LABELS[liftKey]}</Text>

      {/* Segmented toggle: 1RM | 3RM */}
      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleButton, styles.toggleButtonLeft, state.type === '1rm' && styles.toggleButtonActive]}
          onPress={() => onChange(liftKey, { type: '1rm' })}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleButtonText, state.type === '1rm' && styles.toggleButtonTextActive]}>
            1RM
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, styles.toggleButtonRight, state.type === '3rm' && styles.toggleButtonActive]}
          onPress={() => onChange(liftKey, { type: '3rm' })}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleButtonText, state.type === '3rm' && styles.toggleButtonTextActive]}>
            3RM
          </Text>
        </TouchableOpacity>
      </View>

      {/* Weight input */}
      <TextInput
        style={styles.input}
        placeholder="0.0 kg"
        placeholderTextColor={colors.textTertiary}
        value={state.weightKg}
        onChangeText={(v) => onChange(liftKey, { weightKg: v })}
        keyboardType="decimal-pad"
        returnKeyType="done"
      />

      {/* Reps input (3RM only) */}
      {state.type === '3rm' && (
        <TextInput
          style={styles.input}
          placeholder="3"
          placeholderTextColor={colors.textTertiary}
          value={state.reps}
          onChangeText={(v) => onChange(liftKey, { reps: v })}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={2}
        />
      )}

      {/* Estimated 1RM */}
      <Text style={styles.estimated}>
        Est. 1RM: <Text style={styles.estimatedValue}>{estimated}</Text>
      </Text>
    </View>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function LiftMaxesScreen() {
  const [lifts, setLifts] = useState<Record<LiftKey, LiftState>>({
    squat: makeDefaultState(),
    bench: makeDefaultState(),
    deadlift: makeDefaultState(),
  })
  const [usingEstimatedStart, setUsingEstimatedStart] = useState(false)

  function handleChange(key: LiftKey, update: Partial<LiftState>) {
    setUsingEstimatedStart(false)
    setLifts((prev) => ({ ...prev, [key]: { ...prev[key], ...update } }))
  }

  function handleUseEstimatedStart() {
    setLifts({
      squat:    makeDefaultState(),
      bench:    makeDefaultState(),
      deadlift: makeDefaultState(),
    })
    setUsingEstimatedStart(true)
  }

  const allValid = usingEstimatedStart || LIFT_ORDER.every((k) => isLiftValid(lifts[k]))

  function handleNext() {
    if (!allValid) return

    const payload: LiftsPayload | null = usingEstimatedStart
      ? null
      : {
        squat:    buildLiftInput(lifts.squat),
        bench:    buildLiftInput(lifts.bench),
        deadlift: buildLiftInput(lifts.deadlift),
      }

    router.push({
      pathname: '/(auth)/onboarding/program-settings',
      params: {
        lifts: payload ? JSON.stringify(payload) : '',
        estimatedStart: usingEstimatedStart ? '1' : '0',
      },
    })
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Enter Your Maxes</Text>
      <Text style={styles.subtitle}>
        We'll use these to build your first training program.
      </Text>

      {usingEstimatedStart && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            Maxes left blank. We&apos;ll estimate your starting loads and calibrate from your logged sessions.
          </Text>
        </View>
      )}

      {LIFT_ORDER.map((key) => (
        <LiftSection
          key={key}
          liftKey={key}
          state={lifts[key]}
          onChange={handleChange}
        />
      ))}

      <TouchableOpacity
        style={[styles.primaryButton, !allValid && styles.primaryButtonDisabled]}
        onPress={handleNext}
        disabled={!allValid}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Next</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.defaultsLink} onPress={handleUseEstimatedStart} activeOpacity={0.7}>
        <Text style={styles.defaultsLinkText}>I don't know my maxes</Text>
      </TouchableOpacity>
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
    marginBottom: 32,
    lineHeight: 22,
  },
  warningBanner: {
    backgroundColor: colors.warningMuted,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  warningText: {
    fontSize: 13,
    color: colors.warning,
    lineHeight: 18,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  toggle: {
    flexDirection: 'row',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
  },
  toggleButtonLeft: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  toggleButtonRight: {},
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 10,
  },
  estimated: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  estimatedValue: {
    fontWeight: '600',
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  defaultsLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  defaultsLinkText: {
    fontSize: 14,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
})
