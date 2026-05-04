import { StyleSheet, Text, View } from 'react-native';

import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useRecoverySnapshot } from '../hooks/useRecoverySnapshot';
import { HrvTrendChart } from './HrvTrendChart';
import { SleepSummary } from './SleepSummary';

type Snapshot = NonNullable<ReturnType<typeof useRecoverySnapshot>['data']>;

function formatHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

function buildConcernNote(s: Snapshot): string | null {
  if (s.hrv_pct_change !== null && s.hrv_pct_change <= -15) {
    return `HRV ${Math.abs(Math.round(s.hrv_pct_change))}% below baseline — session will be adjusted`;
  }
  if (s.sleep_duration_min !== null && s.sleep_duration_min < 360) {
    return `Short sleep (${formatHours(s.sleep_duration_min)}) — session will be adjusted`;
  }
  if (s.rhr_pct_change !== null && s.rhr_pct_change >= 10) {
    return `Resting HR ${Math.round(s.rhr_pct_change)}% above baseline — session will be adjusted`;
  }
  return null;
}

function buildAccessibilityLabel(s: Snapshot): string {
  const parts: string[] = [];
  parts.push(
    s.readiness_score !== null
      ? `Recovery score ${s.readiness_score} of 100.`
      : 'Recovery score unavailable.'
  );
  if (s.hrv_pct_change !== null) {
    const abs = Math.abs(Math.round(s.hrv_pct_change));
    parts.push(
      s.hrv_pct_change >= 0
        ? `HRV ${abs} percent above baseline.`
        : `HRV ${abs} percent below baseline.`
    );
  }
  if (s.sleep_duration_min !== null) {
    parts.push(`Slept ${formatHours(s.sleep_duration_min)}.`);
  }
  if (s.deep_sleep_pct !== null) {
    parts.push(`${Math.round(s.deep_sleep_pct)} percent deep sleep.`);
  }
  return parts.join(' ');
}

function scoreColor(score: number | null, colors: ColorScheme): string {
  if (score === null) return colors.textTertiary;
  if (score < 40) return colors.danger;
  if (score <= 60) return colors.warning;
  return colors.success;
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    badge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeScore: {
      fontSize: 15,
      fontWeight: '700',
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    concern: {
      fontSize: 13,
      color: colors.warning,
      marginTop: 8,
      lineHeight: 18,
    },
  });
}

export function RecoveryCard() {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  const { data: snapshot } = useRecoverySnapshot();

  if (!snapshot) return null;

  const score = snapshot.readiness_score;
  const concern = buildConcernNote(snapshot);
  const badgeColor = scoreColor(score, colors);

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={buildAccessibilityLabel(snapshot)}
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: badgeColor + '33' }]}>
          <Text style={[styles.badgeScore, { color: badgeColor }]}>
            {score !== null ? String(score) : '—'}
          </Text>
        </View>
        <Text style={styles.title}>Recovery</Text>
      </View>
      <HrvTrendChart />
      <SleepSummary
        durationMin={snapshot.sleep_duration_min}
        deepPct={snapshot.deep_sleep_pct}
        remPct={snapshot.rem_sleep_pct}
      />
      {concern && <Text style={styles.concern}>{concern}</Text>}
    </View>
  );
}
