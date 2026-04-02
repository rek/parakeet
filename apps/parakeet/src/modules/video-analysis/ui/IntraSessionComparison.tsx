import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Svg, { Polyline } from 'react-native-svg';

import type { ColorScheme } from '../../../theme';
import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { SessionVideo } from '../model/types';

// Colors for each set number — distinct, colorblind-friendly
const SET_COLORS = ['#A3E635', '#22D3EE', '#F472B6', '#FB923C', '#A78BFA'];

interface SetBarPath {
  setNumber: number;
  path: Array<{ x: number; y: number }>;
  driftCm: number | null;
  leanDeg: number | null;
  depthCm: number | null;
}

function extractSetPaths({ videos }: { videos: SessionVideo[] }) {
  return videos
    .filter((v) => v.analysis && v.analysis.reps.length > 0)
    .map((v) => {
      // Use the first rep's bar path as representative for this set
      const rep = v.analysis!.reps[0];
      return {
        setNumber: v.setNumber,
        path: rep.barPath.map((p) => ({ x: p.x, y: p.y })),
        driftCm: rep.barDriftCm ?? null,
        leanDeg: rep.forwardLeanDeg ?? null,
        depthCm: rep.maxDepthCm ?? null,
      } satisfies SetBarPath;
    })
    .sort((a, b) => a.setNumber - b.setNumber);
}

function detectFatigueTrend({ sets }: { sets: SetBarPath[] }) {
  if (sets.length < 3) return null;

  const drifts = sets
    .map((s) => s.driftCm)
    .filter((d): d is number => d != null);
  if (drifts.length < 3) return null;

  // Check if drift increases monotonically (fatigue signature)
  let increasing = 0;
  for (let i = 1; i < drifts.length; i++) {
    if (drifts[i] > drifts[i - 1]) increasing++;
  }

  if (increasing >= drifts.length - 1) {
    const firstDrift = drifts[0];
    const lastDrift = drifts[drifts.length - 1];
    const increase = lastDrift - firstDrift;
    return `Bar drift increased ${increase.toFixed(1)}cm from set 1 to set ${sets.length} — fatigue may be affecting form.`;
  }

  return null;
}

/**
 * Overlaid bar paths from multiple sets within the same session+lift.
 * Shows how form changes across sets (fatigue detection).
 * Each set has a distinct color. Includes drift/lean/depth trend table.
 */
export function IntraSessionComparison({ videos }: { videos: SessionVideo[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const sets = useMemo(() => extractSetPaths({ videos }), [videos]);

  const fatigue = useMemo(() => detectFatigueTrend({ sets }), [sets]);

  if (sets.length < 2) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>SET COMPARISON</Text>

      {/* Overlaid bar paths */}
      <View style={styles.chartContainer}>
        <Svg
          width="100%"
          height={180}
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
        >
          {sets.map((s, i) =>
            s.path.length > 1 ? (
              <Polyline
                key={`set-${s.setNumber}`}
                points={s.path.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={SET_COLORS[i % SET_COLORS.length]}
                strokeWidth={0.005}
                opacity={0.8}
              />
            ) : null
          )}
        </Svg>

        {/* Legend */}
        <View style={styles.legend}>
          {sets.map((s, i) => (
            <View key={`legend-${s.setNumber}`} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: SET_COLORS[i % SET_COLORS.length] },
                ]}
              />
              <Text style={styles.legendText}>Set {s.setNumber}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Trend table */}
      <View style={styles.trendTable}>
        <View style={styles.trendRow}>
          <Text style={[styles.trendCell, styles.trendHeaderCell]}>Set</Text>
          <Text style={[styles.trendCell, styles.trendHeaderCell]}>Drift</Text>
          <Text style={[styles.trendCell, styles.trendHeaderCell]}>Lean</Text>
          <Text style={[styles.trendCell, styles.trendHeaderCell]}>Depth</Text>
        </View>
        {sets.map((s, i) => (
          <View key={`trend-${s.setNumber}`} style={styles.trendRow}>
            <View style={styles.trendCellRow}>
              <View
                style={[
                  styles.trendDot,
                  { backgroundColor: SET_COLORS[i % SET_COLORS.length] },
                ]}
              />
              <Text style={styles.trendCell}>{s.setNumber}</Text>
            </View>
            <Text style={styles.trendCell}>
              {s.driftCm != null ? `${s.driftCm.toFixed(1)}cm` : '—'}
            </Text>
            <Text style={styles.trendCell}>
              {s.leanDeg != null ? `${s.leanDeg.toFixed(0)}°` : '—'}
            </Text>
            <Text style={styles.trendCell}>
              {s.depthCm != null ? `${s.depthCm.toFixed(1)}cm` : '—'}
            </Text>
          </View>
        ))}
      </View>

      {/* Fatigue narrative */}
      {fatigue && (
        <View style={styles.fatigueCard}>
          <Text style={styles.fatigueText}>{fatigue}</Text>
        </View>
      )}
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      gap: spacing[3],
    },
    sectionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chartContainer: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[3],
      gap: spacing[2],
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[3],
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
    },
    trendTable: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[2],
    },
    trendRow: {
      flexDirection: 'row',
      paddingVertical: spacing[1],
    },
    trendCellRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    trendDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    trendCell: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text,
    },
    trendHeaderCell: {
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    fatigueCard: {
      backgroundColor: colors.warningMuted,
      borderRadius: radii.md,
      padding: spacing[3],
    },
    fatigueText: {
      fontSize: typography.sizes.sm,
      color: colors.warning,
    },
  });
}
