// @spec docs/features/disruptions/spec-resolution.md
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { palette, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { ColorScheme } from '../../../theme';
import {
  DEFAULT_DISRUPTION_SHELF_LIFE_DAYS,
  DISRUPTION_SHELF_LIFE_DAYS,
} from '../lib/disruption-shelf-life';
import type { ActiveDisruption } from './DisruptionChipsRow';

interface Props {
  disruption: ActiveDisruption;
  onStillActive: (extendDays: number) => void;
  onRecovered: () => void;
  onSnooze: () => void;
}

/**
 * One-tap "is this still ongoing?" prompt for a disruption submitted without
 * an end date. Surfaces three actions: extend the shelf life, resolve the
 * disruption, or snooze for a day. Stateless — the parent owns snooze state
 * and refetch invalidation; this is presentation-only.
 */
export function OngoingDisruptionPrompt({
  disruption,
  onStillActive,
  onRecovered,
  onSnooze,
}: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const label = disruption.description || disruption.disruption_type;
  const extendDays =
    DISRUPTION_SHELF_LIFE_DAYS[
      disruption.disruption_type as keyof typeof DISRUPTION_SHELF_LIFE_DAYS
    ] ?? DEFAULT_DISRUPTION_SHELF_LIFE_DAYS;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Is "{label}" still ongoing?</Text>
      <Text style={styles.subtext}>
        You reported this without an end date. Let us know so the programme
        stays accurate.
      </Text>
      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => onStillActive(extendDays)}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Still active</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onRecovered}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>Recovered</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSnooze}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>Remind me later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSurface,
      padding: spacing[4],
      borderRadius: 12,
      marginBottom: spacing[3],
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginBottom: spacing[1],
    },
    subtext: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing[3],
    },
    buttons: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
    primaryButton: {
      backgroundColor: palette.lime400,
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[3],
      borderRadius: 8,
    },
    primaryButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: palette.black,
    },
    secondaryButton: {
      backgroundColor: colors.bgMuted,
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[3],
      borderRadius: 8,
    },
    secondaryButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
  });
}
