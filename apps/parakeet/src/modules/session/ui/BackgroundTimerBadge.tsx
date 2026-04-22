// @spec docs/features/rest-timer/spec-timer-ui.md
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import type { TimerState } from '@platform/store/sessionStore';

import { formatMMSS } from '../../../shared/utils';
import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { formatExerciseName } from '../utils/formatExerciseName';

interface BackgroundTimerBadgeProps {
  backgroundTimers: Array<{ key: string; timer: TimerState }>;
  onSwitch: (key: string) => void;
}

export function BackgroundTimerBadge({
  backgroundTimers,
  onSwitch,
}: BackgroundTimerBadgeProps) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          flexGrow: 0,
          marginBottom: spacing[2],
        },
        scrollContent: {
          flexDirection: 'row',
          gap: spacing[2],
          paddingHorizontal: spacing[1],
        },
        pill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[1.5],
          backgroundColor: colors.bgMuted,
          borderRadius: radii.full,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing[1],
          paddingHorizontal: spacing[3],
        },
        pillOvertime: {
          borderColor: colors.warning,
        },
        name: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.medium,
          color: colors.textSecondary,
          maxWidth: 120,
        },
        time: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.bold,
          color: colors.textSecondary,
          fontVariant: ['tabular-nums'],
        },
        timeOvertime: {
          color: colors.warning,
        },
      }),
    [colors]
  );

  if (backgroundTimers.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      {backgroundTimers.map(({ key, timer }) => {
        const effectiveDuration = timer.durationSeconds + timer.offset;
        const remaining = Math.max(0, effectiveDuration - timer.elapsed);
        const overtime = timer.elapsed > effectiveDuration;
        const display = overtime
          ? `+${formatMMSS(timer.elapsed - effectiveDuration)}`
          : formatMMSS(remaining);
        const label =
          key === 'main'
            ? 'Main'
            : key === 'warmup'
              ? 'Warmup'
              : formatExerciseName(key);

        return (
          <TouchableOpacity
            key={key}
            style={[styles.pill, overtime && styles.pillOvertime]}
            onPress={() => onSwitch(key)}
            activeOpacity={0.7}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${label} timer, ${display} remaining`}
          >
            <Text style={styles.name} numberOfLines={1}>
              {label}
            </Text>
            <Text style={[styles.time, overtime && styles.timeOvertime]}>
              {display}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
