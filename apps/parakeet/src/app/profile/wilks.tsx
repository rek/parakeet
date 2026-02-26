import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../../hooks/useAuth'
import { getWilksHistory } from '../../lib/achievements'
import { getCurrentMaxes } from '../../lib/lifter-maxes'
import { computeWilks2020 } from '@parakeet/training-engine'
import { supabase } from '../../lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

const WILKS_CONTEXT = [
  { label: 'World-class', range: '500+' },
  { label: 'Elite', range: '450–500' },
  { label: 'Advanced', range: '350–450' },
  { label: 'Intermediate', range: '250–350' },
  { label: 'Beginner', range: '<250' },
]

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WilksScreen() {
  const { user } = useAuth()

  const historyQuery = useQuery({
    queryKey: ['achievements', 'wilks-history', user?.id],
    queryFn: () => getWilksHistory(user!.id),
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  })

  const currentQuery = useQuery({
    queryKey: ['achievements', 'wilks-current', user?.id],
    queryFn: async () => {
      const [maxes, profileResult] = await Promise.all([
        getCurrentMaxes(user!.id),
        supabase
          .from('profiles')
          .select('biological_sex, bodyweight_kg')
          .eq('id', user!.id)
          .maybeSingle(),
      ])
      if (!maxes) return null

      const profile = profileResult.data
      const sex: 'male' | 'female' =
        profile?.biological_sex === 'female' ? 'female' : 'male'
      const bodyweightKg =
        (profile as { bodyweight_kg?: number } | null)?.bodyweight_kg ?? 85

      const squatKg = maxes.squat_1rm_grams / 1000
      const benchKg = maxes.bench_1rm_grams / 1000
      const deadliftKg = maxes.deadlift_1rm_grams / 1000
      const totalKg = squatKg + benchKg + deadliftKg
      const wilks = computeWilks2020(totalKg, bodyweightKg, sex)

      return {
        wilks: Math.round(wilks),
        squatKg,
        benchKg,
        deadliftKg,
        bodyweightKg,
        sex,
        recordedAt: maxes.recorded_at,
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  const isLoading = historyQuery.isLoading || currentQuery.isLoading

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.screenTitle}>WILKS Score</Text>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : (
          <>
            {/* Current score */}
            {currentQuery.data && (
              <View style={styles.currentCard}>
                <Text style={styles.currentScoreLabel}>Current Score</Text>
                <Text style={styles.currentScore}>{currentQuery.data.wilks}</Text>
                <Text style={styles.currentMeta}>
                  Bodyweight: {currentQuery.data.bodyweightKg} kg
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/settings')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bwLink}>Update bodyweight →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Current maxes table */}
            {currentQuery.data && (
              <>
                <Text style={styles.sectionHeader}>Lifts Used</Text>
                <View style={styles.card}>
                  {[
                    { lift: 'Squat', kg: currentQuery.data.squatKg },
                    { lift: 'Bench', kg: currentQuery.data.benchKg },
                    { lift: 'Deadlift', kg: currentQuery.data.deadliftKg },
                  ].map(({ lift, kg }) => (
                    <View key={lift} style={styles.liftRow}>
                      <Text style={styles.liftRowLabel}>{lift}</Text>
                      <Text style={styles.liftRowValue}>{kg.toFixed(1)} kg est. 1RM</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Per-cycle history */}
            {(historyQuery.data?.length ?? 0) > 0 && (
              <>
                <Text style={styles.sectionHeader}>Cycle History</Text>
                <View style={styles.card}>
                  {historyQuery.data!.map((point) => (
                    <View key={point.cycleNumber} style={styles.historyRow}>
                      <Text style={styles.historyLabel}>Cycle {point.cycleNumber}</Text>
                      <Text style={styles.historyDate}>{point.date}</Text>
                      <Text style={styles.historyScore}>{point.wilksScore}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Reference context */}
            <Text style={styles.sectionHeader}>Reference</Text>
            <View style={styles.card}>
              {WILKS_CONTEXT.map(({ label, range }) => (
                <View key={label} style={styles.refRow}>
                  <Text style={styles.refLabel}>{label}</Text>
                  <Text style={styles.refRange}>{range}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
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
    paddingTop: 16,
    paddingBottom: 48,
  },
  centered: {
    paddingTop: 64,
    alignItems: 'center',
  },
  backRow: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 16,
    color: '#4F46E5',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 24,
  },
  // Current score card
  currentCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  currentScoreLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4338CA',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  currentScore: {
    fontSize: 56,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  currentMeta: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  bwLink: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 4,
    marginBottom: 20,
  },
  // Lifts used
  liftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  liftRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  liftRowValue: {
    fontSize: 14,
    color: '#374151',
  },
  // History
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  historyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  historyDate: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 16,
  },
  historyScore: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
  },
  // Reference
  refRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  refLabel: {
    fontSize: 14,
    color: '#374151',
  },
  refRange: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
})
