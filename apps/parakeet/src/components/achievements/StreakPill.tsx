import { StyleSheet, Text, TouchableOpacity } from 'react-native'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StreakPillProps {
  currentStreak: number
  onPress?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StreakPill({ currentStreak, onPress }: StreakPillProps) {
  if (currentStreak < 1) return null

  return (
    <TouchableOpacity
      style={styles.pill}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Text style={styles.text}>🔥 {currentStreak} wk</Text>
    </TouchableOpacity>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pill: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
})
