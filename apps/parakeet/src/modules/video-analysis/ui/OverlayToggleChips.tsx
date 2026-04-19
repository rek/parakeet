import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';

/**
 * Toggle chips for playback overlays (bar path, skeleton).
 *
 * Renders above the video. Each chip is `accessibilityRole="switch"`. When
 * an overlay is unavailable (e.g. skeleton has no stored landmarks), the
 * chip renders disabled with an explanatory sub-label.
 */
export function OverlayToggleChips({
  barPathEnabled,
  onToggleBarPath,
  skeletonEnabled,
  onToggleSkeleton,
  skeletonAvailable,
  colors,
}: {
  barPathEnabled: boolean;
  onToggleBarPath: (value: boolean) => void;
  skeletonEnabled: boolean;
  onToggleSkeleton: (value: boolean) => void;
  skeletonAvailable: boolean;
  colors: ColorScheme;
}) {
  const styles = buildStyles(colors);

  return (
    <View style={styles.row}>
      <Chip
        label="Bar path"
        enabled={barPathEnabled}
        available
        onToggle={() => onToggleBarPath(!barPathEnabled)}
        colors={colors}
      />
      <Chip
        label="Skeleton"
        enabled={skeletonEnabled && skeletonAvailable}
        available={skeletonAvailable}
        subLabel={skeletonAvailable ? null : 'No landmarks for this video'}
        onToggle={() => onToggleSkeleton(!skeletonEnabled)}
        colors={colors}
      />
    </View>
  );
}

function Chip({
  label,
  enabled,
  available,
  subLabel,
  onToggle,
  colors,
}: {
  label: string;
  enabled: boolean;
  available: boolean;
  subLabel?: string | null;
  onToggle: () => void;
  colors: ColorScheme;
}) {
  const styles = buildStyles(colors);
  return (
    <Pressable
      onPress={available ? onToggle : undefined}
      disabled={!available}
      style={[
        styles.chip,
        enabled && available && styles.chipEnabled,
        !available && styles.chipDisabled,
      ]}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: enabled, disabled: !available }}
    >
      <Text
        style={[
          styles.chipLabel,
          enabled && available && styles.chipLabelEnabled,
          !available && styles.chipLabelDisabled,
        ]}
      >
        {label}
      </Text>
      {subLabel != null && <Text style={styles.subLabel}>{subLabel}</Text>}
    </Pressable>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing[2],
      paddingHorizontal: spacing[3],
      paddingTop: spacing[3],
      paddingBottom: spacing[2],
      flexWrap: 'wrap',
    },
    chip: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgMuted,
    },
    chipEnabled: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    chipDisabled: {
      opacity: 0.5,
    },
    chipLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },
    chipLabelEnabled: {
      color: colors.bg,
    },
    chipLabelDisabled: {
      color: colors.textTertiary,
    },
    subLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      marginTop: 2,
    },
  });
}
