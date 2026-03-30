import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { LIFT_LABELS } from '@shared/constants';

import type { ColorScheme } from '../../../theme';
import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { PartnerWithSession } from '../hooks/usePartnerSessions';

export function PartnerCard({
  partner,
  onFilm,
}: {
  partner: PartnerWithSession;
  onFilm: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const hasSession = partner.activeSession !== null;
  const liftLabel = partner.activeSession?.primaryLift
    ? (LIFT_LABELS[
        partner.activeSession.primaryLift as keyof typeof LIFT_LABELS
      ] ?? partner.activeSession.primaryLift)
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View
          style={[styles.dot, hasSession ? styles.dotActive : styles.dotIdle]}
        />
        <View style={styles.info}>
          <Text style={styles.name}>{partner.partnerName}</Text>
          <Text style={styles.status}>
            {hasSession ? `${liftLabel} — Active` : 'No active session'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.filmButton, !hasSession && styles.filmButtonDisabled]}
          onPress={onFilm}
          disabled={!hasSession}
          activeOpacity={0.7}
          accessibilityLabel={`Film ${partner.partnerName}`}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.filmText,
              !hasSession && styles.filmTextDisabled,
            ]}
          >
            Film
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing[4],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    dotActive: {
      backgroundColor: colors.success,
    },
    dotIdle: {
      backgroundColor: colors.textTertiary,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    status: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    filmButton: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1.5],
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    filmButtonDisabled: {
      backgroundColor: colors.bgMuted,
    },
    filmText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
    filmTextDisabled: {
      color: colors.textDisabled,
    },
  });
}
