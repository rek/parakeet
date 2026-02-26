import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors, radii, spacing, typography } from '../../theme'

interface BackLinkProps {
  label?: string
  onPress: () => void
}

export function BackLink({ label = 'Back', onPress }: BackLinkProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.glyphWrap}>
        <Text style={styles.glyph}>‹</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.notch} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[1.5],
    paddingLeft: spacing[1.5],
    paddingRight: spacing[3],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  glyphWrap: {
    width: spacing[5],
    height: spacing[5],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primarySubtle,
  },
  glyph: {
    color: colors.primary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    lineHeight: typography.sizes.base,
    marginRight: 1,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  notch: {
    width: spacing[1.5],
    height: spacing[1.5],
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    opacity: 0.9,
  },
})
