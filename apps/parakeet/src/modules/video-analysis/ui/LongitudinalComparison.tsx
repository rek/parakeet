import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import type { VideoAnalysisResult } from '@parakeet/shared-types';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import type { SessionVideo } from '../model/types';

/** Opacity levels for overlaid historical paths — most recent is brightest. */
const PATH_OPACITIES = [0.7, 0.55, 0.4, 0.3, 0.2];

/**
 * Overlays bar paths from multiple sessions on a single SVG canvas for
 * visual comparison of form across training sessions. Most recent session
 * is drawn last (on top) with the brightest color.
 *
 * Also shows a trend summary of key metrics across sessions.
 */
export function LongitudinalComparison({
  currentAnalysis,
  previousVideos,
  colors,
}: {
  currentAnalysis: VideoAnalysisResult;
  previousVideos: SessionVideo[];
  colors: ColorScheme;
}) {
  const styles = useMemo(() => buildStyles(colors), [colors]);

  // Memoize filtered list so downstream useMemo dependencies are stable
  const videosWithAnalysis = useMemo(
    () => previousVideos.filter((v) => v.analysis && v.analysis.reps.length > 0),
    [previousVideos],
  );

  // Compute trend data across sessions — must be before any early return (hooks rules)
  const trendData = useMemo(() => {
    const allAnalyses = videosWithAnalysis
      .map((v) => ({
        date: v.createdAt.slice(0, 10),
        analysis: v.analysis!,
      }))
      .reverse(); // chronological order

    return allAnalyses.map(({ date, analysis }) => {
      const reps = analysis.reps;
      const avgDrift =
        reps.reduce((sum, r) => sum + (r.barDriftCm ?? 0), 0) / reps.length;
      const avgLean =
        reps.reduce((sum, r) => sum + (r.forwardLeanDeg ?? 0), 0) / reps.length;
      const avgRom =
        reps.reduce((sum, r) => sum + (r.romCm ?? 0), 0) / reps.length;
      return { date, avgDrift, avgLean, avgRom, repCount: reps.length };
    });
  }, [videosWithAnalysis]);

  if (videosWithAnalysis.length === 0) return null;

  // Collect all bar paths — each video's rep 1 path for comparison
  const historicalPaths = videosWithAnalysis
    .slice(0, PATH_OPACITIES.length)
    .map((v) => ({
      date: v.createdAt.slice(0, 10),
      path: v.analysis!.reps[0]?.barPath ?? [],
    }))
    .reverse(); // oldest first → drawn first (underneath)

  const currentPath = currentAnalysis.reps[0]?.barPath ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>
        Previous Sessions ({videosWithAnalysis.length})
      </Text>

      {/* Overlaid bar paths */}
      <View style={styles.svgContainer}>
        <Svg width="100%" height={200} viewBox="0 0 1 1" preserveAspectRatio="none">
          {/* Historical paths (dimmer, underneath) */}
          {historicalPaths.map((hp, i) =>
            hp.path.length > 1 ? (
              <Polyline
                key={hp.date}
                points={hp.path.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={colors.primary}
                strokeWidth={0.004}
                opacity={PATH_OPACITIES[i] ?? 0.2}
              />
            ) : null,
          )}

          {/* Current path (bright, on top) */}
          {currentPath.length > 1 && (
            <Polyline
              points={currentPath.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={colors.primary}
              strokeWidth={0.006}
              opacity={1}
            />
          )}
        </Svg>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>Current</Text>
          </View>
          {historicalPaths.slice(-1).map((hp) => (
            <View key={hp.date} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: colors.primary, opacity: 0.5 },
                ]}
              />
              <Text style={styles.legendText}>Previous</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Trend table */}
      {trendData.length > 0 && (
        <View style={styles.trendTable}>
          <View style={styles.trendHeaderRow}>
            <Text style={[styles.trendCell, styles.trendHeaderCell]}>Date</Text>
            <Text style={[styles.trendCell, styles.trendHeaderCell]}>Drift</Text>
            <Text style={[styles.trendCell, styles.trendHeaderCell]}>Lean</Text>
            <Text style={[styles.trendCell, styles.trendHeaderCell]}>ROM</Text>
          </View>
          {trendData.slice(-5).map((row) => (
            <View key={row.date} style={styles.trendRow}>
              <Text style={[styles.trendCell, styles.trendDateCell]}>
                {row.date.slice(5)}
              </Text>
              <Text style={styles.trendCell}>
                {row.avgDrift.toFixed(1)}cm
              </Text>
              <Text style={styles.trendCell}>
                {row.avgLean.toFixed(0)}°
              </Text>
              <Text style={styles.trendCell}>
                {row.avgRom.toFixed(0)}cm
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      marginBottom: spacing[3],
    },
    sectionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.widest,
      marginBottom: spacing[2],
    },
    svgContainer: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[2],
      marginBottom: spacing[2],
    },
    legend: {
      flexDirection: 'row',
      gap: spacing[4],
      marginTop: spacing[2],
      paddingHorizontal: spacing[1],
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: radii.full,
    },
    legendText: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
    trendTable: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    trendHeaderRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[3],
    },
    trendRow: {
      flexDirection: 'row',
      paddingVertical: spacing[1.5],
      paddingHorizontal: spacing[3],
    },
    trendHeaderCell: {
      fontWeight: typography.weights.semibold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      fontSize: typography.sizes.xs,
      letterSpacing: typography.letterSpacing.wider,
    },
    trendCell: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text,
    },
    trendDateCell: {
      color: colors.textSecondary,
    },
  });
}
