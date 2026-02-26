import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuth } from '../../hooks/useAuth';
import { getPerformanceTrends } from '../../lib/performance';
import { getCompletedSessions } from '../../lib/sessions';
import { listPrograms } from '../../lib/programs';
import { colors, spacing, radii, typography } from '../../theme';

import type { PerformanceTrend } from '../../lib/performance';

// ── Types ─────────────────────────────────────────────────────────────────────

type CompletedSession = Awaited<ReturnType<typeof getCompletedSessions>>[number];

// ── Sub-components ────────────────────────────────────────────────────────────

interface TrendCardProps {
  trend: PerformanceTrend;
}

function TrendCard({ trend }: TrendCardProps) {
  const trendConfig = {
    improving: { symbol: '↑', color: colors.success },
    stable:    { symbol: '→', color: colors.textSecondary },
    declining: { symbol: '↓', color: colors.danger },
  } as const;

  const { symbol, color } = trendConfig[trend.trend];

  const liftLabel: Record<string, string> = {
    squat: 'Squat',
    bench: 'Bench',
    deadlift: 'Deadlift',
  };

  return (
    <View style={styles.trendCard}>
      <Text style={styles.trendLiftName}>{liftLabel[trend.lift] ?? trend.lift}</Text>
      <Text style={styles.trendOneRm}>{trend.estimatedOneRmKg.toFixed(1)} kg</Text>
      <Text style={[styles.trendArrow, { color }]}>{symbol}</Text>
      <Text style={styles.trendMeta}>{trend.sessionsLogged} sessions</Text>
      <Text style={styles.trendMeta}>{Math.round(trend.avgCompletionPct)}% completion</Text>
    </View>
  );
}

interface SessionRowProps {
  session: CompletedSession;
}

function SessionRow({ session }: SessionRowProps) {
  const liftLabel: Record<string, string> = {
    squat: 'Squat',
    bench: 'Bench',
    deadlift: 'Deadlift',
  };

  const intensityLabel: Record<string, string> = {
    heavy: 'Heavy',
    explosive: 'Explosive',
    rep: 'Rep',
    deload: 'Deload',
  };

  const liftName = liftLabel[session.primary_lift] ?? session.primary_lift;
  const intensityName = intensityLabel[session.intensity_type] ?? session.intensity_type;

  return (
    <View style={styles.sessionRow}>
      <View style={styles.sessionRowLeft}>
        <Text style={styles.sessionRowTitle}>
          {liftName} — {intensityName}
        </Text>
        <Text style={styles.sessionRowDate}>{session.planned_date ?? '—'}</Text>
      </View>
      <View style={styles.completedBadge}>
        <Text style={styles.completedBadgeText}>Done</Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { user } = useAuth();

  const trendsQuery = useQuery({
    queryKey: ['performance', 'trends', user?.id],
    queryFn: () => getPerformanceTrends(user!.id),
    enabled: !!user?.id,
  });

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'completed', user?.id],
    queryFn: () => getCompletedSessions(user!.id, 0, 20),
    enabled: !!user?.id,
  });

  const programsQuery = useQuery({
    queryKey: ['programs', 'archived', user?.id],
    queryFn: async () => {
      const all = await listPrograms(user!.id);
      return (all ?? []).filter((p) => p.status === 'archived');
    },
    enabled: !!user?.id,
  });

  const isLoading = trendsQuery.isLoading || sessionsQuery.isLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>History</Text>

        {/* Trends section */}
        <Text style={styles.sectionHeader}>Estimated 1RM</Text>

        {trendsQuery.data && trendsQuery.data.length > 0 ? (
          <View style={styles.trendRow}>
            {(['squat', 'bench', 'deadlift'] as const).map((lift) => {
              const trend = trendsQuery.data.find((t) => t.lift === lift);
              if (!trend) return null;
              return <TrendCard key={lift} trend={trend} />;
            })}
          </View>
        ) : (
          <Text style={styles.emptyText}>No performance data yet.</Text>
        )}

        {/* Completed programs section */}
        {(programsQuery.data?.length ?? 0) > 0 && (
          <>
            <Text style={styles.sectionHeader}>Completed Programs</Text>
            <View style={{ marginBottom: spacing[6] }}>
              {programsQuery.data!.map((program) => (
                <View key={program.id} style={styles.programRow}>
                  <View style={styles.programRowLeft}>
                    <Text style={styles.programRowTitle}>Program v{program.version ?? 1}</Text>
                    <Text style={styles.sessionRowDate}>
                      {program.total_weeks} weeks · {program.training_days_per_week} days/week
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.reviewButton}
                    onPress={() => router.push(`/history/cycle-review/${program.id}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.reviewButtonText}>Review</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Completed sessions section */}
        <Text style={styles.sectionHeader}>Recent Sessions</Text>

        {sessionsQuery.data && sessionsQuery.data.length > 0 ? (
          <View>
            {sessionsQuery.data.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No sessions completed yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[12],
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: spacing[6],
    letterSpacing: typography.letterSpacing.tight,
  },
  sectionHeader: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    marginBottom: spacing[3],
    marginTop: spacing[2],
  },
  // Trend cards
  trendRow: {
    flexDirection: 'row',
    marginBottom: spacing[8],
    gap: spacing[2],
  },
  trendCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing[3],
    backgroundColor: colors.bgSurface,
  },
  trendLiftName: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing[1],
  },
  trendOneRm: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: spacing[0.5],
  },
  trendArrow: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing[1.5],
  },
  trendMeta: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    lineHeight: 16,
  },
  // Session rows
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  sessionRowLeft: {
    flex: 1,
    marginRight: spacing[3],
  },
  sessionRowTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing[0.5],
  },
  sessionRowDate: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  completedBadge: {
    backgroundColor: colors.successMuted,
    borderRadius: radii.xs,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderWidth: 1,
    borderColor: colors.success,
  },
  completedBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.textTertiary,
    marginBottom: spacing[8],
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  programRowLeft: { flex: 1, marginRight: spacing[3] },
  programRowTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing[0.5],
  },
  reviewButton: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.sm,
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reviewButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
});
