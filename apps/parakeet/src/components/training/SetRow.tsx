import { useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

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

  // Emit update whenever any value changes
  useEffect(() => {
    onUpdate({ weightKg, reps, rpe, isCompleted })
    // Intentionally omitting onUpdate from deps — callers should memoize or accept stable identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightKg, reps, rpe, isCompleted])

  // ── Handlers ────────────────────────────────────────────────────────────

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

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.wrapper, isCompleted && styles.wrapperCompleted]}>
      {/* Main input row */}
      <View style={styles.row}>
        {/* Set number label */}
        <Text style={styles.setLabel}>Set {setNumber}</Text>

        {/* Weight input */}
        <TextInput
          style={styles.weightInput}
          value={weightKg === 0 ? '' : String(weightKg)}
          onChangeText={handleWeightChange}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder={String(plannedWeightKg)}
          placeholderTextColor="#9CA3AF"
          textAlign="center"
        />
        <Text style={styles.unitText}>kg</Text>

        <Text style={styles.multiplyText}>×</Text>

        {/* Reps input */}
        <TextInput
          style={styles.repsInput}
          value={reps === 0 ? '' : String(reps)}
          onChangeText={handleRepsChange}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder={String(plannedReps)}
          placeholderTextColor="#9CA3AF"
          textAlign="center"
        />

        {/* RPE input */}
        <TextInput
          style={styles.rpeInput}
          value={rpe !== undefined ? String(rpe) : ''}
          onChangeText={handleRpeChange}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder="RPE"
          placeholderTextColor="#9CA3AF"
          textAlign="center"
        />

        {/* Complete toggle */}
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  wrapperCompleted: {
    backgroundColor: '#F0FDF4',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setLabel: {
    width: 48,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  weightInput: {
    width: 70,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
    paddingHorizontal: 4,
  },
  unitText: {
    fontSize: 13,
    color: '#6B7280',
  },
  multiplyText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  repsInput: {
    width: 48,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
    paddingHorizontal: 4,
  },
  rpeInput: {
    width: 48,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
    paddingHorizontal: 4,
  },
  checkButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  checkButtonDone: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  checkButtonText: {
    fontSize: 18,
    color: '#D1D5DB',
    fontWeight: '700',
    lineHeight: 22,
  },
  checkButtonTextDone: {
    color: '#fff',
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginLeft: 54, // aligns under the weight input
  },
  adjustButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adjustButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
})
