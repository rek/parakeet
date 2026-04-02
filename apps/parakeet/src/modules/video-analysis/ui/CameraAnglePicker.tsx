import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';

type CameraAngle = 'side' | 'front';

const ANGLE_OPTIONS: { value: CameraAngle; label: string; hint: string }[] = [
  { value: 'side', label: 'Side View', hint: 'Bar path, depth, lean' },
  { value: 'front', label: 'Front View', hint: 'Knee valgus' },
];

/**
 * Toggle between side and front camera angles before recording or selecting a
 * video. Drives which analysis metrics are surfaced after processing.
 */
export function CameraAnglePicker({
  selected,
  onChange,
  colors,
}: {
  selected: CameraAngle;
  onChange: (angle: CameraAngle) => void;
  colors: ColorScheme;
}) {
  return (
    <View style={styles.row} accessible={false}>
      {ANGLE_OPTIONS.map((option) => {
        const isActive = option.value === selected;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.button,
              {
                backgroundColor: isActive ? colors.primary : colors.bgSurface,
                borderColor: isActive ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.75}
            accessible={true}
            accessibilityLabel={`${option.label}: ${option.hint}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
          >
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.textInverse : colors.text },
              ]}
            >
              {option.label}
            </Text>
            <Text
              style={[
                styles.hint,
                {
                  color: isActive
                    ? colors.textInverse + 'bb'
                    : colors.textTertiary,
                },
              ]}
            >
              {option.hint}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  button: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    gap: spacing[1],
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  hint: {
    fontSize: typography.sizes.xs,
  },
});
