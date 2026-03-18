import { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getTrendConfig } from '@modules/history';
import type { LiftHistory, TrendDirection } from '@modules/history';
import { formatDate } from '@shared/utils/date';
import { capitalize } from '@shared/utils/string';

import { Sheet } from '../../../components/ui/Sheet';
import { spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  lift: string;
  visible: boolean;
  onClose: () => void;
  data: LiftHistory | undefined;
  isLoading: boolean;
  isError: boolean;
  isOffline: boolean;
}

function formatOneRm(kg: number): string {
  if (kg <= 0) return '\u2014';
  return `${Math.round(kg)} kg`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiftHistorySheet({
  lift,
  visible,
  onClose,
  data,
  isLoading,
  isError,
  isOffline,
}: Props) {
  const { colors } = useTheme();

  const trendConfig = getTrendConfig(colors);

  function trendSymbol(trend: TrendDirection | null): string {
    return trend ? trendConfig[trend].symbol : '';
  }

  function trendColor(trend: TrendDirection | null): string {
    return trend ? trendConfig[trend].color : colors.textSecondary;
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
        colDate: { flex: 2 },
        colOneRm: { flex: 2, textAlign: 'right' as const },
        colRpe: { flex: 1, textAlign: 'right' as const },
        colCompletion: { flex: 1.5, textAlign: 'right' as const },
      }),
    [colors]
  );

  const title = `Recent ${capitalize(lift)} Performance`;

  function renderContent() {
    if (isLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.center}>
          <Text style={styles.stateText}>Could not load history</Text>
          <Text style={styles.stateSubtext}>Session logging is unaffected</Text>
        </View>
      );
    }

    if (isOffline && !data) {
      return (
        <View style={styles.center}>
          <Text style={styles.stateText}>History unavailable offline</Text>
        </View>
      );
    }

    if (!data || data.entries.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.stateText}>
            No previous {capitalize(lift)} sessions
          </Text>
        </View>
      );
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
            <Text style={[styles.cell, styles.colDate]}>
              {formatDate(entry.completedAt)}
            </Text>
            <Text style={[styles.cell, styles.colOneRm]}>
              {formatOneRm(entry.estimatedOneRmKg)}
            </Text>
            <Text style={[styles.cell, styles.colRpe]}>
              {entry.sessionRpe != null ? entry.sessionRpe.toFixed(1) : '\u2014'}
            </Text>
            <Text style={[styles.cell, styles.colCompletion]}>
              {entry.completionPct != null
                ? `${Math.round(entry.completionPct)}%`
                : '\u2014'}
            </Text>
          </View>
        ))}
      </>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      position="bottom"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>
    </Sheet>
  );
}
