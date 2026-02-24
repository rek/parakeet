import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { WorkoutCard } from '../../components/training/WorkoutCard'
import { useAuth } from '../../hooks/useAuth'
import { useActiveProgram } from '../../hooks/useActiveProgram'
import { useTodaySession } from '../../hooks/useTodaySession'
import { useWeeklyVolume } from '../../hooks/useWeeklyVolume'
import { getActiveDisruptions } from '../../lib/disruptions'
import type { MuscleGroup, VolumeStatus } from '@parakeet/training-engine'

// ── Volume compact card ───────────────────────────────────────────────────────

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  quads:      'Quads',
  hamstrings: 'Hamstrings',
  glutes:     'Glutes',
  lower_back: 'Lower Back',
  upper_back: 'Upper Back',
  chest:      'Chest',
  triceps:    'Triceps',
  shoulders:  'Shoulders',
  biceps:     'Biceps',
}

const BAR_COLORS: Record<VolumeStatus, string> = {
  below_mev:       '#F59E0B',
  in_range:        '#10B981',
  approaching_mrv: '#FBBF24',
  at_mrv:          '#EF4444',
  exceeded_mrv:    '#EF4444',
}

const COMPACT_MUSCLES: MuscleGroup[] = ['quads', 'chest', 'hamstrings', 'upper_back', 'lower_back']

function VolumeCompactCard() {
  const { data } = useWeeklyVolume()

  return (
    <View style={styles.volumeCard}>
      <View style={styles.volumeCardHeader}>
        <Text style={styles.volumeCardTitle}>Weekly Volume</Text>
        <TouchableOpacity onPress={() => router.push('/volume')} activeOpacity={0.7}>
          <Text style={styles.volumeViewAll}>View All →</Text>
        </TouchableOpacity>
      </View>

      {!data ? (
        <Text style={styles.volumeLoading}>Loading…</Text>
      ) : (
        COMPACT_MUSCLES.map((muscle) => {
          const sets   = data.weekly[muscle]
          const mrv    = data.config[muscle].mrv
          const status = data.status[muscle]
          const fillPct = mrv > 0 ? Math.min(100, (sets / mrv) * 100) : 0
          const isOver  = status === 'at_mrv' || status === 'exceeded_mrv'

          return (
            <View key={muscle} style={styles.volumeRow}>
              <Text style={styles.volumeRowLabel}>{MUSCLE_LABELS[muscle]}</Text>
              <View style={styles.volumeBarTrack}>
                <View
                  style={[
                    styles.volumeBarFill,
                    { width: `${fillPct}%`, backgroundColor: BAR_COLORS[status] },
                  ]}
                />
              </View>
              <Text style={[styles.volumeRowSets, isOver && styles.volumeRowSetsOver]}>
                {sets}/{mrv}{isOver ? ' ⚠' : ''}
              </Text>
            </View>
          )
        })
      )}
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const { user } = useAuth()
  const { data: session, isLoading: sessionLoading } = useTodaySession()
  const { data: program, isLoading: programLoading } = useActiveProgram()
  const { data: volumeData } = useWeeklyVolume()
  const queryClient = useQueryClient()

  const { data: disruptions } = useQuery({
    queryKey: ['disruptions', 'active', user?.id],
    queryFn: () => getActiveDisruptions(user!.id),
    enabled: !!user?.id,
  })

  if (sessionLoading || programLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </SafeAreaView>
    )
  }

  // Muscles at or exceeding MRV — for warning banner
  const mrvWarningMuscles = volumeData
    ? (Object.entries(volumeData.status) as [MuscleGroup, VolumeStatus][])
        .filter(([, s]) => s === 'at_mrv' || s === 'exceeded_mrv')
        .map(([m]) => MUSCLE_LABELS[m])
    : []

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Parakeet</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!program ? (
          // No program state
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Welcome to Parakeet</Text>
            <Text style={styles.emptySubtitle}>
              Create a program to get started.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/(auth)/onboarding/lift-maxes')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Create Program</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* MRV warning banner */}
            {mrvWarningMuscles.length > 0 && (
              <View style={styles.mrvBanner}>
                <Text style={styles.mrvBannerText}>
                  {mrvWarningMuscles.join(', ')} {mrvWarningMuscles.length === 1 ? 'has' : 'have'} reached weekly MRV — volume automatically reduced.
                </Text>
              </View>
            )}

            {session ? (
              <WorkoutCard
                session={session}
                activeDisruptions={disruptions ?? []}
                onSkipComplete={() =>
                  queryClient.invalidateQueries({ queryKey: ['session', 'today'] })
                }
              />
            ) : (
              <View style={styles.restDayCard}>
                <Text style={styles.restDayTitle}>Rest Day</Text>
                <Text style={styles.restDaySubtitle}>
                  Keep recovering — next session coming up soon.
                </Text>
              </View>
            )}

            <VolumeCompactCard />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
    gap: 12,
  },
  // No program / empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Rest day card
  restDayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 28,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  restDayTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  restDaySubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  // MRV warning banner
  mrvBanner: {
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 4,
  },
  mrvBannerText: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  // Volume compact card
  volumeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginHorizontal: 16,
  },
  volumeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  volumeCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  volumeViewAll: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '500',
  },
  volumeLoading: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  volumeRowLabel: {
    fontSize: 13,
    color: '#374151',
    width: 80,
  },
  volumeBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  volumeBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  volumeRowSets: {
    fontSize: 12,
    color: '#6B7280',
    width: 52,
    textAlign: 'right',
  },
  volumeRowSetsOver: {
    color: '#EF4444',
    fontWeight: '600',
  },
})
