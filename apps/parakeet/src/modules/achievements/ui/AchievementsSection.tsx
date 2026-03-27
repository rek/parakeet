import { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type {
  CycleBadge,
  FunBadgeRow,
  HistoricalPRs,
} from '@modules/achievements';
import { formatDate } from '@shared/utils/date';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { StreakResult } from '../lib/engine-adapter';
import { BadgeIcon } from './BadgeIcon';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AchievementsSectionProps {
  badges: CycleBadge[];
  streak: StreakResult | undefined;
  prs: Record<string, HistoricalPRs | undefined>;
  funBadges: FunBadgeRow[];
  isLoading: boolean;
  onBadgePress: (programId: string) => void;
  onWilksPress: () => void;
  onPRPress?: (sessionId: string) => void;
  onFunBadgePress?: (sessionId: string) => void;
}

type SectionStyles = ReturnType<typeof buildStyles>;

// ── Styles builder ────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    loadingContainer: {
      paddingVertical: spacing[8],
      alignItems: 'center',
    },
    sectionHeader: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.widest,
      marginBottom: spacing[2],
      marginTop: spacing[4],
    },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing[1],
      marginBottom: spacing[1],
    },
    emptyCard: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[4],
      marginTop: spacing[4],
    },
    emptyTitle: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginBottom: spacing[1],
    },
    emptyBody: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    badgeLeft: {
      flex: 1,
    },
    badgeTitle: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing[0.5],
    },
    badgeMeta: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    chevron: {
      fontSize: 22,
      color: colors.textTertiary,
      lineHeight: 24,
    },
    streakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2.5],
    },
    streakEmoji: {
      fontSize: 16,
      marginRight: spacing[2],
      width: 22,
    },
    streakLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      width: 64,
    },
    streakValue: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.secondary,
      flex: 1,
    },
    streakMeta: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      flex: 1,
    },
    prBlock: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2.5],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    prBlockTappable: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    prContent: {
      flex: 1,
    },
    prLiftName: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
      color: colors.primary,
      marginBottom: spacing[1],
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
    },
    prLine: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing[0.5],
    },
    prDate: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
    wilksRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3.5],
    },
    wilksHint: {
      fontSize: typography.sizes.base,
      color: colors.textSecondary,
      flex: 1,
    },
    funBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2.5],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    funBadgeIcon: {
      marginRight: spacing[3],
      width: 28,
      height: 28,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    funBadgeContent: {
      flex: 1,
    },
    funBadgeName: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    funBadgeDescription: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      marginTop: 1,
    },
    funBadgeFlavor: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      marginTop: 1,
      fontStyle: 'italic',
    },
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  label,
  styles,
}: {
  label: string;
  styles: SectionStyles;
}) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function PRRow({
  lift,
  prs,
  styles,
  onPress,
}: {
  lift: string;
  prs: HistoricalPRs;
  styles: SectionStyles;
  onPress?: (sessionId: string) => void;
}) {
  const liftLabel = lift.charAt(0).toUpperCase() + lift.slice(1);
  const best1rm =
    prs.best1rmKg > 0 ? `${prs.best1rmKg.toFixed(1)} kg est. 1RM` : null;
  const best1rmDate = prs.best1rmDate ? formatDate(prs.best1rmDate) : null;

  const repPRWeights = Object.keys(prs.repPRs)
    .map(Number)
    .sort((a, b) => b - a);
  const topRepWeight = repPRWeights[0];
  const topRepCount =
    topRepWeight !== undefined ? prs.repPRs[topRepWeight] : null;
  const repLine =
    topRepCount != null ? `${topRepCount} reps @ ${topRepWeight} kg` : null;
  const repDate =
    topRepWeight !== undefined && prs.repPRDates?.[topRepWeight]
      ? formatDate(prs.repPRDates[topRepWeight]!)
      : null;

  if (!best1rm && !repLine) return null;

  const sessionId = prs.best1rmSessionId;
  const isTappable = !!sessionId && !!onPress;

  const content = (
    <>
      <View style={styles.prContent}>
        <Text style={styles.prLiftName}>{liftLabel}</Text>
        {best1rm && (
          <Text style={styles.prLine}>
            {best1rm}
            {best1rmDate && <Text style={styles.prDate}> · {best1rmDate}</Text>}
          </Text>
        )}
        {repLine && (
          <Text style={styles.prLine}>
            {repLine}
            {repDate && <Text style={styles.prDate}> · {repDate}</Text>}
          </Text>
        )}
      </View>
      {isTappable && <Text style={styles.chevron}>›</Text>}
    </>
  );

  if (isTappable) {
    return (
      <TouchableOpacity
        style={[styles.prBlock, styles.prBlockTappable]}
        onPress={() => onPress(sessionId)}
        activeOpacity={0.7}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`View ${liftLabel} PR session`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.prBlock}>{content}</View>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AchievementsSection({
  badges,
  streak,
  prs,
  funBadges,
  isLoading,
  onBadgePress,
  onWilksPress,
  onPRPress,
  onFunBadgePress,
}: AchievementsSectionProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => buildStyles(colors), [colors]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const hasPRs = Object.values(prs).some(
    (p) => p && (p.best1rmKg > 0 || Object.keys(p.repPRs).length > 0)
  );
  const hasStreak =
    !!streak && (streak.currentStreak > 0 || streak.longestStreak > 0);
  const hasAnyAchievements =
    badges.length > 0 || hasStreak || hasPRs || funBadges.length > 0;

  return (
    <View>
      {!hasAnyAchievements && (
        <View style={[styles.card, styles.emptyCard]}>
          <Text style={styles.emptyTitle}>No achievements yet</Text>
          <Text style={styles.emptyBody}>
            Finish workouts consistently to unlock streaks, PRs, and cycle
            badges.
          </Text>
        </View>
      )}

      {/* Cycle badges */}
      {badges.length > 0 && (
        <>
          <SectionHeader
            label={`Cycles Completed [ ${badges.length} badge${badges.length !== 1 ? 's' : ''} ]`}
            styles={styles}
          />
          <View style={styles.card}>
            {badges.map((badge) => (
              <TouchableOpacity
                key={badge.programId}
                style={styles.badgeRow}
                onPress={() => onBadgePress(badge.programId)}
                activeOpacity={0.7}
              >
                <View style={styles.badgeLeft}>
                  <Text style={styles.badgeTitle}>
                    Cycle {badge.cycleNumber}
                  </Text>
                  <Text style={styles.badgeMeta}>
                    {badge.weekCount} wk ·{' '}
                    {Math.round(badge.completionPct * 100)}% completion
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Fun badges */}
      {funBadges.length > 0 && (
        <>
          <SectionHeader
            label={`Badges [ ${funBadges.length} ]`}
            styles={styles}
          />
          <View style={styles.card}>
            {funBadges.map((badge) => {
              const sessionId = badge.sessionId;
              const badgeTappable = !!sessionId && !!onFunBadgePress;
              const badgeContent = (
                <>
                  <View style={styles.funBadgeIcon}>
                    <BadgeIcon
                      badgeId={badge.id}
                      emoji={badge.emoji}
                      size={28}
                    />
                  </View>
                  <View style={styles.funBadgeContent}>
                    <Text style={styles.funBadgeName}>{badge.name}</Text>
                    <Text style={styles.funBadgeDescription}>
                      {badge.description}
                    </Text>
                    <Text style={styles.funBadgeFlavor}>{badge.flavor}</Text>
                  </View>
                  {badgeTappable && <Text style={styles.chevron}>›</Text>}
                </>
              );

              if (badgeTappable) {
                return (
                  <TouchableOpacity
                    key={badge.id}
                    style={styles.funBadgeRow}
                    onPress={() => onFunBadgePress(sessionId)}
                    activeOpacity={0.7}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`View session for ${badge.name} badge`}
                  >
                    {badgeContent}
                  </TouchableOpacity>
                );
              }

              return (
                <View key={badge.id} style={styles.funBadgeRow}>
                  {badgeContent}
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Streak */}
      {hasStreak && (
        <>
          <SectionHeader label="Streak" styles={styles} />
          <View style={styles.card}>
            {streak.currentStreak > 0 && (
              <View style={styles.streakRow}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text style={styles.streakLabel}>Current</Text>
                <Text style={styles.streakValue}>
                  {streak.currentStreak} weeks clean
                </Text>
              </View>
            )}
            {streak.longestStreak > 0 && (
              <View style={styles.streakRow}>
                <Text style={styles.streakEmoji}> </Text>
                <Text style={styles.streakLabel}>Best</Text>
                <Text style={styles.streakMeta}>
                  {streak.longestStreak} weeks
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Personal records */}
      {hasPRs && (
        <>
          <SectionHeader label="Personal Records" styles={styles} />
          <View style={styles.card}>
            {(['squat', 'bench', 'deadlift'] as const).map((lift) => {
              const liftPRs = prs[lift];
              if (!liftPRs) return null;
              if (
                liftPRs.best1rmKg === 0 &&
                Object.keys(liftPRs.repPRs).length === 0
              )
                return null;
              return (
                <PRRow
                  key={lift}
                  lift={lift}
                  prs={liftPRs}
                  styles={styles}
                  onPress={onPRPress}
                />
              );
            })}
          </View>
        </>
      )}

      {/* WILKS */}
      <SectionHeader label="WILKS Score" styles={styles} />
      <TouchableOpacity
        style={[styles.card, styles.wilksRow]}
        onPress={onWilksPress}
        activeOpacity={0.7}
      >
        <Text style={styles.wilksHint}>Tap to view full WILKS history</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}
