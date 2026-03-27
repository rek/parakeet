import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { EarnedBadge } from '../lib/engine-adapter';
import { BadgeIcon } from './BadgeIcon';

interface BadgeCardProps {
  badge: EarnedBadge;
  /** Delay in ms before the slide-up animation starts (for staggering). */
  delay?: number;
}

export function BadgeCard({ badge, delay = 0 }: BadgeCardProps) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

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
    ]).start();
  }, [delay, opacity, translateY]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primaryMuted,
          borderWidth: 1.5,
          borderColor: colors.primary,
          borderRadius: radii.md,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3.5],
          marginBottom: spacing[2.5],
        },
        iconContainer: {
          width: 36,
          height: 36,
          marginRight: spacing[3],
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        textContainer: {
          flex: 1,
        },
        name: {
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.bold,
          color: colors.primary,
        },
        flavor: {
          fontSize: typography.sizes.sm,
          color: colors.textSecondary,
          marginTop: 2,
        },
      }),
    [colors]
  );

  return (
    <Animated.View
      style={[styles.card, { opacity, transform: [{ translateY }] }]}
    >
      <View style={styles.iconContainer}>
        <BadgeIcon badgeId={badge.id} emoji={badge.emoji} size={36} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.name}>{badge.name}</Text>
        <Text style={styles.flavor}>{badge.flavor}</Text>
      </View>
    </Animated.View>
  );
}
