import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import type { PR } from '@parakeet/training-engine'
import { colors, radii, spacing, typography } from '../../theme'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StarCardProps {
  pr: PR
  /** Delay in ms before the slide-up animation starts (for staggering). */
  delay?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatPRText(pr: PR): string {
  const lift = capitalize(pr.lift)
  switch (pr.type) {
    case 'estimated_1rm':
      return `New ${lift} Estimated 1RM — ${pr.value.toFixed(1)} kg`
    case 'volume':
      return `New ${lift} Volume PR — ${Math.round(pr.value).toLocaleString()} kg total`
    case 'rep_at_weight':
      return `New ${lift} Rep PR — ${pr.value} reps @ ${pr.weightKg ?? 0} kg`
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StarCard({ pr, delay = 0 }: StarCardProps) {
  const translateY = useRef(new Animated.Value(24)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]).start()
  }, [delay, opacity, translateY])

  return (
    <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.star}>⭐</Text>
      <View style={styles.textContainer}>
        <Text style={styles.prText}>{formatPRText(pr)}</Text>
      </View>
    </Animated.View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryMuted,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    marginBottom: spacing[2.5],
  },
  star: {
    fontSize: 22,
    marginRight: spacing[3],
  },
  textContainer: {
    flex: 1,
  },
  prText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.secondary,
  },
})
