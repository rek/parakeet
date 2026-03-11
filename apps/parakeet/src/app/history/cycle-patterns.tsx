import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'

import { useAuth } from '@modules/auth'
import {
  computePhaseStats,
  CYCLE_PHASE_BG,
  CYCLE_PHASE_LABELS,
  CYCLE_PHASES,
  generateInsight,
  MIN_CYCLES_FOR_PATTERNS,
  PHASE_BAR_FILL,
} from '@modules/cycle-tracking'
import { getCompletedSessions } from '@modules/session'
import { BackLink } from '../../components/navigation/BackLink'
import { spacing, radii, typography } from '../../theme'
import type { ColorScheme } from '../../theme'
import { useTheme } from '../../theme/ThemeContext'

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    scrollView: { flex: 1 },
    container: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[12],
    },
    title: {
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weights.black,
      color: colors.text,
      marginBottom: spacing[5],
      marginTop: spacing[2],
      letterSpacing: typography.letterSpacing.tight,
    },
    noticeCard: {
      backgroundColor: colors.warningMuted,
      borderRadius: radii.md,
      padding: spacing[4],
      marginBottom: spacing[5],
    },
    noticeText: {
      fontSize: typography.sizes.sm,
      color: colors.warning,
      lineHeight: 18,
    },
    sectionHeader: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.widest,
      marginBottom: spacing[3],
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing[2.5],
      gap: spacing[2],
    },
    barLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      width: 84,
    },
    barTrack: {
      flex: 1,
      height: 20,
      borderRadius: radii.xs,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: radii.xs,
    },
    barValue: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      width: 64,
      textAlign: 'right',
    },
    insightCard: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
      marginTop: spacing[6],
    },
    insightText: {
      fontSize: typography.sizes.base,
      color: colors.text,
      lineHeight: 22,
    },
    emptyText: {
      fontSize: typography.sizes.base,
      color: colors.textTertiary,
      marginTop: spacing[8],
      textAlign: 'center',
      lineHeight: 22,
    },
  })
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CyclePatternsScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => buildStyles(colors), [colors])
  const { user } = useAuth()

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions', 'completed', user?.id, 'all'],
    queryFn: () => getCompletedSessions(user!.id, 0, 200),
    enabled: !!user?.id,
  })

  const phasedSessions = (sessions ?? []).filter((s) => s.cycle_phase)
  const stats = computePhaseStats(phasedSessions)

  // Estimate distinct cycles: rough heuristic — count sessions with cycle data
  // across phase transitions. Use simple count ÷ 4 phases as a proxy.
  const uniquePhasesFilled = CYCLE_PHASES.filter((p) => stats[p].sessionCount > 0).length
  const hasEnoughData = phasedSessions.length >= MIN_CYCLES_FOR_PATTERNS * 4

  const insight = generateInsight(stats)

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <BackLink onPress={() => router.back()} />
        <Text style={styles.title}>Cycle Patterns</Text>

        {isLoading ? null : !hasEnoughData ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>
              Keep tracking — patterns become visible after 2–3 cycles ({phasedSessions.length} phase-tagged sessions so far)
            </Text>
          </View>
        ) : null}

        {/* RPE by phase */}
        <Text style={styles.sectionHeader}>Average RPE by Phase</Text>
        {CYCLE_PHASES.map((phase) => {
          const stat = stats[phase]
          const barPct = stat.avgRpe != null ? (stat.avgRpe / 10) * 100 : 0
          return (
            <View key={phase} style={styles.barRow}>
              <Text style={styles.barLabel}>{CYCLE_PHASE_LABELS[phase]}</Text>
              <View style={[styles.barTrack, { backgroundColor: CYCLE_PHASE_BG[phase] }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${barPct}%`,
                      backgroundColor: PHASE_BAR_FILL[phase],
                    },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>
                {stat.avgRpe != null ? stat.avgRpe.toFixed(1) : '—'}
                {stat.sessionCount > 0 ? ` (${stat.sessionCount})` : ''}
              </Text>
            </View>
          )
        })}

        {/* Session count by phase */}
        <Text style={[styles.sectionHeader, { marginTop: spacing[6] }]}>Sessions per Phase</Text>
        {CYCLE_PHASES.map((phase) => {
          const stat = stats[phase]
          const maxCount = Math.max(...CYCLE_PHASES.map((p) => stats[p].sessionCount), 1)
          const barPct = (stat.sessionCount / maxCount) * 100
          return (
            <View key={phase} style={styles.barRow}>
              <Text style={styles.barLabel}>{CYCLE_PHASE_LABELS[phase]}</Text>
              <View style={[styles.barTrack, { backgroundColor: CYCLE_PHASE_BG[phase] }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${barPct}%`,
                      backgroundColor: PHASE_BAR_FILL[phase],
                    },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{stat.sessionCount}</Text>
            </View>
          )
        })}

        {/* Insight */}
        {insight && (
          <View style={styles.insightCard}>
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        )}

        {uniquePhasesFilled === 0 && !isLoading && (
          <Text style={styles.emptyText}>No cycle phase data yet. Complete sessions with cycle tracking enabled to see patterns.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

