import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'

import { getCycleBadges, getStreakData, getPRHistory } from '../../lib/achievements'
import type { HistoricalPRs } from '../../lib/achievements'

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

  // Find best rep-at-weight (highest weight with a rep PR)
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
        <ActivityIndicator size="small" color="#4F46E5" />
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

  return (
    <View>
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
      {streak && (streak.currentStreak > 0 || streak.longestStreak > 0) && (
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
    paddingVertical: 32,
    alignItems: 'center',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 4,
    marginBottom: 4,
  },
  // Badges
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  badgeLeft: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  badgeMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
    lineHeight: 22,
  },
  // Streak
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  streakEmoji: {
    fontSize: 16,
    marginRight: 8,
    width: 22,
  },
  streakLabel: {
    fontSize: 14,
    color: '#6B7280',
    width: 64,
  },
  streakValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  streakMeta: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  // Personal records
  prBlock: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  prLiftName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  prLine: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 2,
  },
  // WILKS
  wilksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  wilksHint: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
})
