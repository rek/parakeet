// @spec docs/features/flock/spec-ui.md
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { FlockCard as FlockCardModel } from '../model/flock.types';

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function deltaParts(delta: number | null): {
  text: string;
  tone: 'up' | 'down' | 'flat';
} {
  if (delta === null || delta === 0) return { text: '▬', tone: 'flat' };
  if (delta > 0) return { text: `▲ +${delta}`, tone: 'up' };
  return { text: `▼ ${delta}`, tone: 'down' };
}

export function FlockCard({ card }: { card: FlockCardModel }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const delta = deltaParts(card.wilksDelta);
  // Only a Wilks gain gets a celebratory color; drops/flat stay muted.
  const deltaColor = delta.tone === 'up' ? colors.success : colors.textTertiary;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.name}>
          {'🦜  '}
          {card.displayName}
        </Text>
        <Text style={styles.time}>{relativeTime(card.publishedAt)}</Text>
      </View>

      <Text style={styles.headline}>{card.headline}</Text>

      <View style={styles.stats}>
        {card.wilks !== null && (
          <Text style={styles.stat}>
            Wilks {card.wilks}{' '}
            <Text style={[styles.delta, { color: deltaColor }]}>
              {delta.text}
            </Text>
          </Text>
        )}
        {card.streakWeeks !== null && card.streakWeeks > 0 && (
          <Text style={styles.stat}>🔥 {card.streakWeeks}-wk streak</Text>
        )}
      </View>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
      gap: spacing[2],
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    name: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    time: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
    headline: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    stats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[4],
    },
    stat: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    delta: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
    },
  });
}
