import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { DietFood } from '../model/types';

/**
 * Highlights daily-ritual categories — morning_shot and rad_superfoods —
 * as a compact summary card. Only renders if such rows exist in the
 * protocol.
 */
export function DailyRituals({ foods }: { foods: DietFood[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const shot = useMemo(
    () =>
      foods
        .filter((f) => f.category === 'morning_shot' && f.status === 'yes')
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [foods],
  );
  const superfoods = useMemo(
    () =>
      foods
        .filter((f) => f.category === 'rad_superfoods' && f.status === 'yes')
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [foods],
  );

  if (shot.length === 0 && superfoods.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.header}>Daily Rituals</Text>
      {shot.length > 0 && (
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons
              name="sunny-outline"
              size={18}
              color={colors.secondary}
            />
            <Text style={styles.title}>Morning Shot</Text>
          </View>
          <Text style={styles.hint}>
            Taken on waking before food — anti-inflammatory.
          </Text>
          <View style={styles.pillRow}>
            {shot.map((f) => (
              <Pill key={f.id} label={f.displayName} detail={f.notes} styles={styles} />
            ))}
          </View>
        </View>
      )}
      {superfoods.length > 0 && (
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons
              name="leaf-outline"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.title}>Superfoods — eat daily / near-daily</Text>
          </View>
          <View style={styles.pillRow}>
            {superfoods.map((f) => (
              <Pill key={f.id} label={f.displayName} detail={f.notes} styles={styles} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Pill({
  label,
  detail,
  styles,
}: {
  label: string;
  detail: string | null;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
      {detail ? <Text style={styles.pillDetail}>{detail}</Text> : null}
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    wrap: { gap: spacing[3] },
    header: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
    },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      padding: spacing[4],
      gap: spacing[2],
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    title: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    hint: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
      marginTop: spacing[1],
    },
    pill: {
      backgroundColor: colors.bg,
      borderRadius: radii.sm,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      gap: 2,
    },
    pillText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    pillDetail: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
  });
}
