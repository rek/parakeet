import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import type { BiometricReading } from '@parakeet/shared-types';

import { useTheme } from '../../../theme/ThemeContext';
import { useHrvTrend } from '../hooks/useHrvTrend';

const CHART_HEIGHT = 40;
const PADDING = 4;

function bestPerDay(readings: BiometricReading[]): { date: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of readings) {
    const day = r.recorded_at.slice(0, 10);
    const curr = map.get(day) ?? -Infinity;
    if (r.value > curr) map.set(day, r.value);
  }
  return [...map.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function HrvTrendChart() {
  const { colors } = useTheme();
  const { data: readings } = useHrvTrend();
  const [width, setWidth] = useState(0);

  const points = bestPerDay(readings ?? []);

  if (points.length < 3) {
    return (
      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
        Building baseline...
      </Text>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  const innerH = CHART_HEIGHT - PADDING * 2;
  const toY = (v: number) => PADDING + innerH - ((v - min) / range) * innerH;

  const segW = width > 0 ? (width - PADDING * 2) / Math.max(points.length - 1, 1) : 0;
  const toX = (i: number) => PADDING + i * segW;

  const polylinePoints = points.map((p, i) => `${toX(i)},${toY(p.value)}`).join(' ');
  const baselineY = toY(mean);
  const lastI = points.length - 1;

  return (
    <View
      style={styles.container}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={CHART_HEIGHT}>
          <Line
            x1={PADDING}
            y1={baselineY}
            x2={width - PADDING}
            y2={baselineY}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="3,3"
          />
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={colors.textSecondary}
            strokeWidth={1.5}
          />
          <Circle
            cx={toX(lastI)}
            cy={toY(points[lastI].value)}
            r={3}
            fill={colors.primary}
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: CHART_HEIGHT,
    width: '100%',
    marginVertical: 8,
  },
});
