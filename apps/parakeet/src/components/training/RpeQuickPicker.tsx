import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, radii, spacing, typography } from '../../theme'

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

interface RpeQuickPickerProps {
  onSelect: (rpe: number) => void
  onSkip: () => void
}

export function RpeQuickPicker({ onSelect, onSkip }: RpeQuickPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>How'd that feel?</Text>
      <View style={styles.buttons}>
        {RPE_OPTIONS.map((rpe) => (
          <TouchableOpacity
            key={rpe}
            style={styles.rpeButton}
            onPress={() => onSelect(rpe)}
            activeOpacity={0.7}
          >
            <Text style={styles.rpeText}>{rpe}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        onPress={onSkip}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
      >
        <Text style={styles.skip}>Skip</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3.5],
    paddingBottom: spacing[3],
    alignItems: 'center',
    width: '100%',
    maxWidth: 560,
    gap: spacing[2.5],
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[1.5],
  },
  rpeButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 44,
    alignItems: 'center',
  },
  rpeText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  skip: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
})
