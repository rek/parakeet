import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../hooks/useAuth';
import { getPerformanceTrends } from '../../lib/performance';
import { getCompletedSessions } from '../../lib/sessions';

import type { PerformanceTrend } from '../../lib/performance';

// ── Types ─────────────────────────────────────────────────────────────────────

type CompletedSession = Awaited<ReturnType<typeof getCompletedSessions>>[number];

// ── Sub-components ────────────────────────────────────────────────────────────

interface TrendCardProps {
  trend: PerformanceTrend;
}

function TrendCard({ trend }: TrendCardProps) {
  const trendConfig = {
    improving: { symbol: '↑', color: '#16a34a' },
    stable: { symbol: '→', color: '#6b7280' },
    declining: { symbol: '↓', color: '#dc2626' },
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
        <Text style={styles.completedBadgeText}>Completed</Text>
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

  const isLoading = trendsQuery.isLoading || sessionsQuery.isLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4F46E5" />
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
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 8,
  },
  // Trend cards
  trendRow: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  trendCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    margin: 4,
    backgroundColor: '#fff',
  },
  trendLiftName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  trendOneRm: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  trendArrow: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  trendMeta: {
    fontSize: 11,
    color: '#9ca3af',
    lineHeight: 16,
  },
  // Session rows
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sessionRowLeft: {
    flex: 1,
    marginRight: 12,
  },
  sessionRowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  sessionRowDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  completedBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  emptyText: {
    fontSize: 15,
    color: '#9ca3af',
    marginBottom: 32,
  },
});
