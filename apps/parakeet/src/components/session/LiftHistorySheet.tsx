import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'

import type { Lift } from '@parakeet/shared-types'
import { getRecentLiftHistory, TREND_CONFIG } from '@modules/history'
import type { TrendDirection } from '@modules/history'
import { useAuth } from '@modules/auth'
import { useNetworkStatus } from '@platform/network'
import { colors, spacing, typography } from '../../theme'
import { formatDate } from '@shared/utils/date'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  lift: string
  visible: boolean
  onClose: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(v: string) {
  if (!v) return v
  return v.charAt(0).toUpperCase() + v.slice(1)
}


function formatOneRm(kg: number): string {
  if (kg <= 0) return '—'
  return `${Math.round(kg)} kg`
}

function trendSymbol(trend: TrendDirection | null): string {
  return trend ? TREND_CONFIG[trend].symbol : ''
}

function trendColor(trend: TrendDirection | null): string {
  return trend ? TREND_CONFIG[trend].color : colors.textSecondary
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiftHistorySheet({ lift, visible, onClose }: Props) {
  const { user } = useAuth()
  const { isOffline } = useNetworkStatus()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['liftHistory', user?.id, lift],
    queryFn: () => getRecentLiftHistory(user!.id, lift as Lift),
    enabled: visible && !!user?.id && !!lift,
    staleTime: 60_000,
  })

  const title = `Recent ${capitalize(lift)} Performance`

  function renderContent() {
    if (isLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )
    }

    if (isError) {
      return (
        <View style={styles.center}>
          <Text style={styles.stateText}>Could not load history</Text>
          <Text style={styles.stateSubtext}>Session logging is unaffected</Text>
        </View>
      )
    }

    if (isOffline && !data) {
      return (
        <View style={styles.center}>
          <Text style={styles.stateText}>History unavailable offline</Text>
        </View>
      )
    }

    if (!data || data.entries.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.stateText}>No previous {capitalize(lift)} sessions</Text>
        </View>
      )
    }

    return (
      <>
        {data.trend && (
          <View style={styles.trendRow}>
            <Text style={[styles.trendText, { color: trendColor(data.trend) }]}>
              {trendSymbol(data.trend)} {capitalize(data.trend)}
            </Text>
          </View>
        )}

        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.colDate]}>Date</Text>
          <Text style={[styles.headerCell, styles.colOneRm]}>Est. 1RM</Text>
          <Text style={[styles.headerCell, styles.colRpe]}>RPE</Text>
          <Text style={[styles.headerCell, styles.colCompletion]}>Done</Text>
        </View>

        {data.entries.map((entry, i) => (
          <View key={i} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
            <Text style={[styles.cell, styles.colDate]}>{formatDate(entry.completedAt)}</Text>
            <Text style={[styles.cell, styles.colOneRm]}>{formatOneRm(entry.estimatedOneRmKg)}</Text>
            <Text style={[styles.cell, styles.colRpe]}>
              {entry.sessionRpe != null ? entry.sessionRpe.toFixed(1) : '—'}
            </Text>
            <Text style={[styles.cell, styles.colCompletion]}>
              {entry.completionPct != null ? `${Math.round(entry.completionPct)}%` : '—'}
            </Text>
          </View>
        ))}
      </>
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderContent()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlayLight,
  },
  sheet: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '65%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[1],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  closeBtn: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: typography.weights.bold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  center: {
    alignItems: 'center',
    paddingVertical: spacing[6],
    gap: spacing[2],
  },
  stateText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stateSubtext: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  trendRow: {
    marginBottom: spacing[3],
  },
  trendText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing[1],
  },
  headerCell: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: spacing[2],
  },
  rowAlt: {
    backgroundColor: colors.bgMuted,
  },
  cell: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  // Column widths
  colDate:       { flex: 2 },
  colOneRm:      { flex: 2, textAlign: 'right' },
  colRpe:        { flex: 1, textAlign: 'right' },
  colCompletion: { flex: 1.5, textAlign: 'right' },
})
