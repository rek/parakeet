import { useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { colors, spacing, radii, typography } from '../../theme'

// ── Types ────────────────────────────────────────────────────────────────────

interface SetUpdateData {
  weightKg: number
  reps: number
  rpe?: number
  isCompleted: boolean
}

export interface SetRowProps {
  setNumber: number
  plannedWeightKg: number
  plannedReps: number
  onUpdate: (data: SetUpdateData) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SetRow({ setNumber, plannedWeightKg, plannedReps, onUpdate }: SetRowProps) {
  const [weightKg, setWeightKg] = useState(plannedWeightKg)
  const [reps, setReps] = useState(plannedReps)
  const [rpe, setRpe] = useState<number | undefined>(undefined)
  const [isCompleted, setIsCompleted] = useState(false)

  useEffect(() => {
    onUpdate({ weightKg, reps, rpe, isCompleted })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightKg, reps, rpe, isCompleted])

  function handleWeightChange(text: string) {
    const parsed = parseFloat(text)
    if (!isNaN(parsed) && parsed >= 0) {
      setWeightKg(parsed)
    } else if (text === '' || text === '.') {
      setWeightKg(0)
    }
  }

  function handleRepsChange(text: string) {
    const parsed = parseInt(text, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      setReps(parsed)
    } else if (text === '') {
      setReps(0)
    }
  }

  function handleRpeChange(text: string) {
    if (text === '') {
      setRpe(undefined)
      return
    }
    const parsed = parseFloat(text)
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
      setRpe(parsed)
    }
  }

  function handleToggleComplete() {
    setIsCompleted((prev) => !prev)
  }

  function handleWeightAdjust(delta: number) {
    setWeightKg((prev) => Math.max(0, Math.round((prev + delta) * 10) / 10))
  }

  return (
    <View style={[styles.wrapper, isCompleted && styles.wrapperCompleted]}>
      {/* Main input row */}
      <View style={styles.row}>
        <Text style={styles.setLabel}>Set {setNumber}</Text>

        <TextInput
          style={styles.weightInput}
          value={weightKg === 0 ? '' : String(weightKg)}
          onChangeText={handleWeightChange}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder={String(plannedWeightKg)}
          placeholderTextColor={colors.textTertiary}
          textAlign="center"
        />
        <Text style={styles.unitText}>kg</Text>

        <Text style={styles.multiplyText}>×</Text>

        <TextInput
          style={styles.repsInput}
          value={reps === 0 ? '' : String(reps)}
          onChangeText={handleRepsChange}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder={String(plannedReps)}
          placeholderTextColor={colors.textTertiary}
          textAlign="center"
        />

        <TextInput
          style={styles.rpeInput}
          value={rpe !== undefined ? String(rpe) : ''}
          onChangeText={handleRpeChange}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder="RPE"
          placeholderTextColor={colors.textTertiary}
          textAlign="center"
        />

        <TouchableOpacity
          style={[styles.checkButton, isCompleted && styles.checkButtonDone]}
          onPress={handleToggleComplete}
          activeOpacity={0.7}
        >
          <Text style={[styles.checkButtonText, isCompleted && styles.checkButtonTextDone]}>
            ✓
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick-increment buttons */}
      <View style={styles.adjustRow}>
        <TouchableOpacity
          style={styles.adjustButton}
          onPress={() => handleWeightAdjust(-2.5)}
          activeOpacity={0.7}
        >
          <Text style={styles.adjustButtonText}>−2.5</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.adjustButton}
          onPress={() => handleWeightAdjust(2.5)}
          activeOpacity={0.7}
        >
          <Text style={styles.adjustButtonText}>+2.5</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  wrapperCompleted: {
    backgroundColor: colors.successMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  setLabel: {
    width: 48,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  weightInput: {
    width: 70,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    fontSize: typography.sizes.base,
    color: colors.text,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing[1],
  },
  unitText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  multiplyText: {
    fontSize: typography.sizes.base,
    color: colors.textTertiary,
  },
  repsInput: {
    width: 48,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    fontSize: typography.sizes.base,
    color: colors.text,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing[1],
  },
  rpeInput: {
    width: 48,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    fontSize: typography.sizes.sm,
    color: colors.text,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing[1],
  },
  checkButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[1],
  },
  checkButtonDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkButtonText: {
    fontSize: 18,
    color: colors.textTertiary,
    fontWeight: typography.weights.bold,
    lineHeight: 22,
  },
  checkButtonTextDone: {
    color: colors.textInverse,
  },
  adjustRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1.5],
    marginLeft: 54,
  },
  adjustButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.sm,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  adjustButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
})
