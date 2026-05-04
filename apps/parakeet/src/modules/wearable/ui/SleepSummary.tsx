import { StyleSheet, Text, View } from 'react-native';

import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

interface Props {
  durationMin: number | null;
  deepPct: number | null;
  remPct: number | null;
}

function formatHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 12,
      flexWrap: 'wrap',
      marginTop: 8,
    },
    text: {
      fontSize: 13,
      color: colors.text,
    },
    textSecondary: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    textTertiary: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    textDanger: {
      fontSize: 13,
      color: colors.danger,
    },
  });
}

export function SleepSummary({ durationMin, deepPct, remPct }: Props) {
  const { colors } = useTheme();
  const styles = buildStyles(colors);

  if (durationMin === null && deepPct === null && remPct === null) return null;

  return (
    <View style={styles.row}>
      {durationMin !== null && (
        <Text style={styles.text}>{formatHours(durationMin)}</Text>
      )}
      {deepPct !== null && (
        <Text style={deepPct < 15 ? styles.textDanger : styles.textSecondary}>
          {Math.round(deepPct)}% deep
        </Text>
      )}
      {remPct !== null && (
        <Text style={styles.textTertiary}>{Math.round(remPct)}% REM</Text>
      )}
    </View>
  );
}
