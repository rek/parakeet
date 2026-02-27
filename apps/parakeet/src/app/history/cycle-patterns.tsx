import { useQuery } from '@tanstack/react-query'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'

import { useAuth } from '../../hooks/useAuth'
import { getCompletedSessions } from '../../lib/sessions'
import { BackLink } from '../../components/navigation/BackLink'
import { colors, spacing, radii, typography } from '../../theme'

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal', 'late_luteal'] as const
type CyclePhase = typeof PHASES[number]

const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual:   'Menstrual',
  follicular:  'Follicular',
  ovulatory:   'Ovulatory',
  luteal:      'Luteal',
  late_luteal: 'Late Luteal',
}

const PHASE_BAR_BG: Record<CyclePhase, string> = {
  menstrual:   '#FEE2E2',
  follicular:  '#D1FAE5',
  ovulatory:   '#FEF3C7',
  luteal:      '#E0E7FF',
  late_luteal: '#C7D2FE',
}

const PHASE_BAR_FILL: Record<CyclePhase, string> = {
  menstrual:   '#F87171',
  follicular:  '#34D399',
  ovulatory:   '#FBBF24',
  luteal:      '#818CF8',
  late_luteal: '#6366F1',
}

const MIN_CYCLES_FOR_PATTERNS = 2

// ── Helpers ───────────────────────────────────────────────────────────────────

interface PhaseStats {
  avgRpe: number | null
  sessionCount: number
}

function computePhaseStats(
  sessions: Array<{ cycle_phase: string | null; rpe?: number | null }>,
): Record<CyclePhase, PhaseStats> {
  const buckets: Record<CyclePhase, { rpeSum: number; rpeCount: number; total: number }> = {
    menstrual:   { rpeSum: 0, rpeCount: 0, total: 0 },
    follicular:  { rpeSum: 0, rpeCount: 0, total: 0 },
    ovulatory:   { rpeSum: 0, rpeCount: 0, total: 0 },
    luteal:      { rpeSum: 0, rpeCount: 0, total: 0 },
    late_luteal: { rpeSum: 0, rpeCount: 0, total: 0 },
  }

  for (const s of sessions) {
    if (!s.cycle_phase || !(s.cycle_phase in buckets)) continue
    const phase = s.cycle_phase as CyclePhase
    buckets[phase].total++
    if (s.rpe != null) {
      buckets[phase].rpeSum += s.rpe
      buckets[phase].rpeCount++
    }
  }

  return Object.fromEntries(
    PHASES.map((phase) => {
      const b = buckets[phase]
      return [phase, {
        avgRpe: b.rpeCount > 0 ? b.rpeSum / b.rpeCount : null,
        sessionCount: b.total,
      }]
    }),
  ) as Record<CyclePhase, PhaseStats>
}

function generateInsight(stats: Record<CyclePhase, PhaseStats>): string | null {
  const withRpe = PHASES.filter((p) => stats[p].avgRpe != null)
  if (withRpe.length < 2) return null

  let maxPhase = withRpe[0]
  let minPhase = withRpe[0]
  for (const p of withRpe) {
    if (stats[p].avgRpe! > stats[maxPhase].avgRpe!) maxPhase = p
    if (stats[p].avgRpe! < stats[minPhase].avgRpe!) minPhase = p
  }

  if (maxPhase === minPhase) return null

  return `Your average RPE in the ${PHASE_LABELS[maxPhase].toLowerCase()} phase (${stats[maxPhase].avgRpe!.toFixed(1)}) is higher than in the ${PHASE_LABELS[minPhase].toLowerCase()} phase (${stats[minPhase].avgRpe!.toFixed(1)}). This is a common pattern.`
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CyclePatternsScreen() {
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
  const uniquePhasesFilled = PHASES.filter((p) => stats[p].sessionCount > 0).length
  const hasEnoughData = phasedSessions.length >= MIN_CYCLES_FOR_PATTERNS * 4

  const maxRpe = Math.max(...PHASES.map((p) => stats[p].avgRpe ?? 0), 0.01)
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
        {PHASES.map((phase) => {
          const stat = stats[phase]
          const barPct = stat.avgRpe != null ? (stat.avgRpe / 10) * 100 : 0
          return (
            <View key={phase} style={styles.barRow}>
              <Text style={styles.barLabel}>{PHASE_LABELS[phase]}</Text>
              <View style={[styles.barTrack, { backgroundColor: PHASE_BAR_BG[phase] }]}>
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
        {PHASES.map((phase) => {
          const stat = stats[phase]
          const maxCount = Math.max(...PHASES.map((p) => stats[p].sessionCount), 1)
          const barPct = (stat.sessionCount / maxCount) * 100
          return (
            <View key={phase} style={styles.barRow}>
              <Text style={styles.barLabel}>{PHASE_LABELS[phase]}</Text>
              <View style={[styles.barTrack, { backgroundColor: PHASE_BAR_BG[phase] }]}>
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
