import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'

import { useWeeklyVolume } from '../hooks/useWeeklyVolume'
import type { MuscleGroup, VolumeStatus } from '@parakeet/training-engine'

const MUSCLES: MuscleGroup[] = [
  'quads', 'hamstrings', 'glutes', 'lower_back', 'upper_back',
  'chest', 'triceps', 'shoulders', 'biceps',
]

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
  below_mev:      '#F59E0B',
  in_range:       '#10B981',
  approaching_mrv: '#FBBF24',
  at_mrv:         '#EF4444',
  exceeded_mrv:   '#EF4444',
}

interface MuscleBarProps {
  muscle: MuscleGroup
  sets: number
  mrv: number
  mev: number
  status: VolumeStatus
}

function MuscleBar({ muscle, sets, mrv, mev, status }: MuscleBarProps) {
  const fillPct = Math.min(100, mrv > 0 ? (sets / mrv) * 100 : 0)
  const mevPct  = mrv > 0 ? (mev / mrv) * 100 : 0
  const color   = BAR_COLORS[status]
  const isOver  = status === 'at_mrv' || status === 'exceeded_mrv'

  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{MUSCLE_LABELS[muscle]}</Text>
      <View style={styles.barContainer}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${fillPct}%`, backgroundColor: color }]} />
          {mevPct > 0 && (
            <View style={[styles.mevMarker, { left: `${mevPct}%` as unknown as number }]} />
          )}
        </View>
        <Text style={[styles.barSets, isOver && styles.barSetsOver]}>
          {sets}/{mrv}{isOver ? ' ⚠' : ''}
        </Text>
      </View>
    </View>
  )
}

export default function VolumeScreen() {
  const { data, isLoading } = useWeeklyVolume()

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Weekly Volume</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>Sets this week vs. your MRV targets</Text>

        <View style={styles.legend}>
          {(['below_mev', 'in_range', 'approaching_mrv', 'at_mrv'] as VolumeStatus[]).map((s) => (
            <View key={s} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: BAR_COLORS[s] }]} />
              <Text style={styles.legendText}>{s.replace(/_/g, ' ')}</Text>
            </View>
          ))}
        </View>

        <View style={styles.mevNote}>
          <View style={styles.mevMarkerSample} />
          <Text style={styles.mevNoteText}>MEV marker</Text>
        </View>

        {isLoading || !data ? (
          <Text style={styles.loadingText}>Loading…</Text>
        ) : (
          <View style={styles.bars}>
            {MUSCLES.map((muscle) => (
              <MuscleBar
                key={muscle}
                muscle={muscle}
                sets={data.weekly[muscle]}
                mrv={data.config[muscle].mrv}
                mev={data.config[muscle].mev}
                status={data.status[muscle]}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 15,
    color: '#4F46E5',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  mevNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  mevMarkerSample: {
    width: 2,
    height: 12,
    backgroundColor: '#6B7280',
  },
  mevNoteText: {
    fontSize: 11,
    color: '#6B7280',
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 32,
  },
  bars: {
    gap: 16,
  },
  barRow: {
    gap: 6,
  },
  barLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    overflow: 'visible',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  mevMarker: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 16,
    backgroundColor: '#6B7280',
    borderRadius: 1,
  },
  barSets: {
    fontSize: 12,
    color: '#6B7280',
    width: 64,
    textAlign: 'right',
  },
  barSetsOver: {
    color: '#EF4444',
    fontWeight: '600',
  },
})
