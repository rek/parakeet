import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, spacing, radii, typography } from '../../theme'

// ── Types ────────────────────────────────────────────────────────────────────

interface WarmupSet {
  weightKg: number
  reps: number
  label?: string
}

export interface WarmupSectionProps {
  sets: WarmupSet[]
  completedIndices: Set<number>
  onToggle: (index: number, done: boolean) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatWeight(weightKg: number): string {
  if (weightKg <= 20) return `Bar (20 kg)`
  return `${weightKg} kg`
}

// ── Sub-component: single warmup set row ─────────────────────────────────────

interface WarmupSetRowProps {
  index: number
  set: WarmupSet
  isDone: boolean
  onToggle: (index: number, done: boolean) => void
}

function WarmupSetRow({ index, set, isDone, onToggle }: WarmupSetRowProps) {
  return (
    <View style={[styles.setRow, isDone && styles.setRowDone]}>
      <Text style={[styles.setNumber, isDone && styles.textFaded]}>
        {index + 1}
      </Text>
      <View style={styles.setMiddle}>
        <Text style={[styles.weightText, isDone && styles.textFaded, isDone && styles.weightStrike]}>
          {formatWeight(set.weightKg)}
        </Text>
        <Text style={[styles.repsText, isDone && styles.textFaded]}>
          {' '}× {set.reps}
        </Text>
        {set.label ? (
          <Text style={[styles.setLabel, isDone && styles.textFaded]}>
            {' · '}{set.label}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={[styles.checkbox, isDone && styles.checkboxDone]}
        onPress={() => onToggle(index, !isDone)}
        activeOpacity={0.7}
      >
        {isDone && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
    </View>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function WarmupSection({ sets, completedIndices, onToggle }: WarmupSectionProps) {
  const [collapsed, setCollapsed] = useState(false)

  const maxWeight = sets.length > 0
    ? Math.max(...sets.map((s) => s.weightKg))
    : 0

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setCollapsed((prev) => !prev)}
        activeOpacity={0.7}
      >
        <Text style={styles.headerTitle}>Warmup Sets</Text>
        <View style={styles.headerRight}>
          {collapsed && sets.length > 0 && (
            <Text style={styles.summary}>
              ({sets.length} sets, up to {maxWeight} kg)
            </Text>
          )}
          <Text style={styles.chevron}>{collapsed ? '▶' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {!collapsed && (
        <View style={styles.setList}>
          {sets.map((set, index) => (
            <WarmupSetRow
              key={index}
              index={index}
              set={set}
              isDone={completedIndices.has(index)}
              onToggle={onToggle}
            />
          ))}
        </View>
      )}

      <View style={styles.divider} />
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
  },
  headerTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  summary: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  setList: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2.5],
  },
  setRowDone: {
    opacity: 0.4,
  },
  setNumber: {
    width: 28,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  setMiddle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  weightText: {
    fontSize: typography.sizes.base,
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  weightStrike: {
    textDecorationLine: 'line-through',
  },
  repsText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  setLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  textFaded: {
    color: colors.textTertiary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    fontSize: 12,
    color: colors.textInverse,
    fontWeight: typography.weights.bold,
    lineHeight: 14,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing[4],
    marginTop: spacing[1],
  },
})
