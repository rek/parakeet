import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'

import { getCycleBadges, getStreakData, getPRHistory } from '../../lib/achievements'
import type { HistoricalPRs } from '../../lib/achievements'
import { colors, spacing, radii, typography } from '../../theme'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AchievementsSectionProps {
  userId: string
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>
}

function PRRow({ lift, prs }: { lift: string; prs: HistoricalPRs }) {
  const liftLabel = lift.charAt(0).toUpperCase() + lift.slice(1)
  const best1rm = prs.best1rmKg > 0 ? `${prs.best1rmKg.toFixed(1)} kg est. 1RM` : null

  const repPRWeights = Object.keys(prs.repPRs).map(Number).sort((a, b) => b - a)
  const topRepWeight = repPRWeights[0]
  const topRepCount = topRepWeight !== undefined ? prs.repPRs[topRepWeight] : null
  const repLine = topRepCount != null
    ? `${topRepCount} reps @ ${topRepWeight} kg`
    : null

  if (!best1rm && !repLine) return null

  return (
    <View style={styles.prBlock}>
      <Text style={styles.prLiftName}>{liftLabel}</Text>
      {best1rm && <Text style={styles.prLine}>{best1rm}</Text>}
      {repLine && <Text style={styles.prLine}>{repLine}</Text>}
    </View>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AchievementsSection({ userId }: AchievementsSectionProps) {
  const badgesQuery = useQuery({
    queryKey: ['achievements', 'badges', userId],
    queryFn: () => getCycleBadges(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const streakQuery = useQuery({
    queryKey: ['achievements', 'streak', userId],
    queryFn: () => getStreakData(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const squatPRsQuery = useQuery({
    queryKey: ['achievements', 'prs', userId, 'squat'],
    queryFn: () => getPRHistory(userId, 'squat'),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const benchPRsQuery = useQuery({
    queryKey: ['achievements', 'prs', userId, 'bench'],
    queryFn: () => getPRHistory(userId, 'bench'),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const deadliftPRsQuery = useQuery({
    queryKey: ['achievements', 'prs', userId, 'deadlift'],
    queryFn: () => getPRHistory(userId, 'deadlift'),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const isLoading =
    badgesQuery.isLoading ||
    streakQuery.isLoading ||
    squatPRsQuery.isLoading ||
    benchPRsQuery.isLoading ||
    deadliftPRsQuery.isLoading

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  const badges = badgesQuery.data ?? []
  const streak = streakQuery.data
  const prs = {
    squat: squatPRsQuery.data,
    bench: benchPRsQuery.data,
    deadlift: deadliftPRsQuery.data,
  }

  const hasPRs = Object.values(prs).some(
    (p) => p && (p.best1rmKg > 0 || Object.keys(p.repPRs).length > 0),
  )
  const hasStreak = !!streak && (streak.currentStreak > 0 || streak.longestStreak > 0)
  const hasAnyAchievements = badges.length > 0 || hasStreak || hasPRs

  return (
    <View>
      {!hasAnyAchievements && (
        <View style={[styles.card, styles.emptyCard]}>
          <Text style={styles.emptyTitle}>No achievements yet</Text>
          <Text style={styles.emptyBody}>
            Finish workouts consistently to unlock streaks, PRs, and cycle badges.
          </Text>
        </View>
      )}

      {/* Cycle badges */}
      {badges.length > 0 && (
        <>
          <SectionHeader label={`Cycles Completed [ ${badges.length} badge${badges.length !== 1 ? 's' : ''} ]`} />
          <View style={styles.card}>
            {badges.map((badge) => (
              <TouchableOpacity
                key={badge.programId}
                style={styles.badgeRow}
                onPress={() => router.push(`/history/cycle-review/${badge.programId}`)}
                activeOpacity={0.7}
              >
                <View style={styles.badgeLeft}>
                  <Text style={styles.badgeTitle}>Cycle {badge.cycleNumber}</Text>
                  <Text style={styles.badgeMeta}>
                    {badge.weekCount} wk · {Math.round(badge.completionPct * 100)}% completion
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Streak */}
      {hasStreak && (
        <>
          <SectionHeader label="Streak" />
          <View style={styles.card}>
            {streak.currentStreak > 0 && (
              <View style={styles.streakRow}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text style={styles.streakLabel}>Current</Text>
                <Text style={styles.streakValue}>{streak.currentStreak} weeks clean</Text>
              </View>
            )}
            {streak.longestStreak > 0 && (
              <View style={styles.streakRow}>
                <Text style={styles.streakEmoji}>  </Text>
                <Text style={styles.streakLabel}>Best</Text>
                <Text style={styles.streakMeta}>{streak.longestStreak} weeks</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Personal records */}
      {hasPRs && (
        <>
          <SectionHeader label="Personal Records" />
          <View style={styles.card}>
            {(['squat', 'bench', 'deadlift'] as const).map((lift) => {
              const liftPRs = prs[lift]
              if (!liftPRs) return null
              if (liftPRs.best1rmKg === 0 && Object.keys(liftPRs.repPRs).length === 0) return null
              return <PRRow key={lift} lift={lift} prs={liftPRs} />
            })}
          </View>
        </>
      )}

      {/* WILKS */}
      <SectionHeader label="WILKS Score" />
      <TouchableOpacity
        style={[styles.card, styles.wilksRow]}
        onPress={() => router.push('/profile/wilks')}
        activeOpacity={0.7}
      >
        <Text style={styles.wilksHint}>Tap to view full WILKS history</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  // Badges
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
  // Streak
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
  // Personal records
  prBlock: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
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
  // WILKS
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
})
