import { StyleSheet, Text, View } from 'react-native';

import type { BarPathPoint } from '@parakeet/shared-types';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';

const OVERLAY_WIDTH = 280;
const OVERLAY_HEIGHT = 180;
const DOT_RADIUS = 3;

/**
 * Standalone SVG visualization of the bar path for a single rep.
 *
 * Phase 1: Renders as a standalone card (not overlaid on video).
 * Phase 2: Will be composited over <VideoView> once expo-video is integrated.
 *
 * The bar path points are normalized 0..1 in both axes. We scale them to
 * the card dimensions and draw a polyline + endpoint dots.
 */
export function BarPathOverlay({
  points,
  repNumber,
  colors,
}: {
  points: BarPathPoint[];
  repNumber: number;
  colors: ColorScheme;
}) {
  const styles = buildStyles(colors);

  if (points.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>Rep {repNumber} — Bar Path</Text>
        <Text style={styles.emptyText}>No path data</Text>
      </View>
    );
  }

  // Scale normalized 0..1 coordinates to pixel space
  const scaled = points.map((p) => ({
    x: p.x * OVERLAY_WIDTH,
    // Invert Y: SVG origin is top-left, but higher Y in pose coords = lower in frame
    y: (1 - p.y) * OVERLAY_HEIGHT,
  }));

  const polylinePoints = scaled.map((p) => `${p.x},${p.y}`).join(' ');
  const startPt = scaled[0];
  const endPt = scaled[scaled.length - 1];

  // Compute horizontal drift for the summary label
  const xValues = points.map((p) => p.x);
  const driftPx = Math.abs(Math.max(...xValues) - Math.min(...xValues));
  // Rough conversion: 0.01 normalized ≈ 1cm at typical filming distance
  const driftCm = (driftPx * 100).toFixed(1);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Rep {repNumber} — Bar Path</Text>
      <View style={styles.svgContainer}>
        <Svg
          width={OVERLAY_WIDTH}
          height={OVERLAY_HEIGHT}
          viewBox={`0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}`}
        >
          {/* Path line */}
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Start dot */}
          {startPt && (
            <Circle
              cx={startPt.x}
              cy={startPt.y}
              r={DOT_RADIUS}
              fill={colors.info}
            />
          )}
          {/* End dot */}
          {endPt && (
            <Circle
              cx={endPt.x}
              cy={endPt.y}
              r={DOT_RADIUS}
              fill={colors.secondary}
            />
          )}
        </Svg>
      </View>
      <Text style={styles.summary}>
        Horizontal drift: {driftCm} cm · {points.length} frames
      </Text>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
      marginBottom: spacing[3],
    },
    label: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
      marginBottom: spacing[3],
    },
    svgContainer: {
      alignSelf: 'center',
      backgroundColor: colors.bgMuted,
      borderRadius: radii.sm,
      overflow: 'hidden',
      marginBottom: spacing[2],
    },
    summary: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
  });
}
