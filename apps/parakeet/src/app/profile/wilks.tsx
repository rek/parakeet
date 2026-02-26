import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../../hooks/useAuth'
import { getWilksHistory } from '../../lib/achievements'
import { getCurrentWilksSnapshot } from '../../services/wilks.service'
import { colors } from '../../theme'
import { BackLink } from '../../components/navigation/BackLink'

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
    queryFn: () => getCurrentWilksSnapshot(user!.id),
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
        <BackLink onPress={() => router.back()} />

        <Text style={styles.screenTitle}>WILKS Score</Text>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
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
    backgroundColor: colors.bgSurface,
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
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 24,
  },
  // Current score card
  currentCard: {
    backgroundColor: colors.primaryMuted,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  currentScoreLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  currentScore: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  currentMeta: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  bwLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderBottomColor: colors.bgMuted,
  },
  liftRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  liftRowValue: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  // History
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgMuted,
  },
  historyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  historyDate: {
    fontSize: 13,
    color: colors.textSecondary,
    marginRight: 16,
  },
  historyScore: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  // Reference
  refRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgMuted,
  },
  refLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  refRange: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
})
