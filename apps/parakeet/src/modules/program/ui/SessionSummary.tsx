import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ProgramSession } from '@modules/program';
import { formatDate } from '@shared/utils/date';
import { capitalize } from '@shared/utils/string';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { BlockBadge } from './BlockBadge';

interface SessionSummaryProps {
  session: ProgramSession;
  activeSessionId?: string;
  onPress: (session: ProgramSession) => void;
}

export function SessionSummary({
  session,
  activeSessionId,
  onPress,
}: SessionSummaryProps) {
  const { colors } = useTheme();

  const isInProgress = session.status === 'in_progress';
  const isLocked =
    session.status === 'planned' &&
    !!activeSessionId &&
    activeSessionId !== session.id;

  const isActionable =
    (isInProgress || session.status === 'planned') && !isLocked;

  function handlePress() {
    if (!isActionable) return;
    onPress(session);
  }

  const dotColor = isInProgress
    ? colors.primary
    : isLocked
      ? colors.textTertiary
      : ((
          {
            in_progress: colors.primary,
            planned: colors.textTertiary,
            completed: colors.success,
            skipped: colors.danger,
            missed: colors.danger,
          } as Record<string, string>
        )[session.status] ?? colors.textTertiary);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing[2.5],
          borderBottomWidth: 1,
          borderBottomColor: colors.borderMuted,
        },
        rowLocked: {
          opacity: 0.45,
        },
        statusDot: {
          width: 10,
          height: 10,
          borderRadius: radii.full,
          marginRight: spacing[3],
        },
        middle: {
          flex: 1,
        },
        liftRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
          marginBottom: spacing[0.5],
        },
        liftText: {
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
          color: colors.text,
        },
        liftTextLocked: {
          color: colors.textSecondary,
        },
        activeBadge: {
          backgroundColor: colors.primary,
          borderRadius: radii.full,
          paddingHorizontal: spacing[2],
          paddingVertical: 2,
        },
        activeBadgeText: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.bold,
          color: colors.textInverse,
          letterSpacing: typography.letterSpacing.wide,
        },
        lockIcon: {
          fontSize: 11,
        },
        skippedBadge: {
          backgroundColor: colors.dangerMuted,
          borderRadius: radii.full,
          paddingHorizontal: spacing[2],
          paddingVertical: 2,
        },
        skippedBadgeText: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.bold,
          color: colors.danger,
          letterSpacing: typography.letterSpacing.wide,
        },
        missedBadge: {
          backgroundColor: colors.dangerMuted,
          borderRadius: radii.full,
          paddingHorizontal: spacing[2],
          paddingVertical: 2,
        },
        missedBadgeText: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.bold,
          color: colors.danger,
          letterSpacing: typography.letterSpacing.wide,
        },
        dateText: {
          fontSize: typography.sizes.sm,
          color: colors.textSecondary,
        },
        dateTextLocked: {
          color: colors.textTertiary,
        },
      }),
    [colors]
  );

  return (
    <TouchableOpacity
      style={[styles.row, isLocked && styles.rowLocked]}
      onPress={handlePress}
      activeOpacity={isActionable ? 0.7 : 1}
    >
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />

      <View style={styles.middle}>
        <View style={styles.liftRow}>
          <Text style={[styles.liftText, isLocked && styles.liftTextLocked]}>
            {capitalize(session.primary_lift)} — {session.intensity_type}
          </Text>
          {isInProgress && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
          {session.status === 'skipped' && (
            <View style={styles.skippedBadge}>
              <Text style={styles.skippedBadgeText}>Skipped</Text>
            </View>
          )}
          {session.status === 'missed' && (
            <View style={styles.missedBadge}>
              <Text style={styles.missedBadgeText}>Missed</Text>
            </View>
          )}
          {isLocked && <Text style={styles.lockIcon}>🔒</Text>}
        </View>
        <Text style={[styles.dateText, isLocked && styles.dateTextLocked]}>
          {session.completed_at
            ? formatDate(session.completed_at)
            : formatDate(session.planned_date)}
        </Text>
      </View>

      <BlockBadge block={session.block_number} />
    </TouchableOpacity>
  );
}
