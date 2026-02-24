import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

// ── Types ────────────────────────────────────────────────────────────────────

interface WarmupSet {
  weight_kg: number
  reps: number
  label?: string
}

export interface WarmupSectionProps {
  sets: WarmupSet[]
  completedIndices: Set<number>
  onToggle: (index: number, done: boolean) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatWeight(weight_kg: number): string {
  if (weight_kg <= 20) return `Bar (20 kg)`
  return `${weight_kg} kg`
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
          {formatWeight(set.weight_kg)}
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
    ? Math.max(...sets.map((s) => s.weight_kg))
    : 0

  return (
    <View style={styles.container}>
      {/* Collapsible header */}
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

      {/* Set rows */}
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

      {/* Divider */}
      <View style={styles.divider} />
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summary: {
    fontSize: 13,
    color: '#6B7280',
  },
  chevron: {
    fontSize: 12,
    color: '#6B7280',
  },
  setList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  setRowDone: {
    opacity: 0.4,
  },
  setNumber: {
    width: 28,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  setMiddle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  weightText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  weightStrike: {
    textDecorationLine: 'line-through',
  },
  repsText: {
    fontSize: 15,
    color: '#374151',
  },
  setLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  textFaded: {
    color: '#9CA3AF',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  checkmark: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
    marginTop: 4,
  },
})
