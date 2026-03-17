import { StyleSheet, Text, View } from 'react-native';

import type { ColorScheme } from '../../../theme';
import { getReadinessPillColors } from './readiness-styles';

const READINESS_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Normal',
  3: 'Great',
};

const ENERGY_LABELS: Record<number, string> = {
  1: 'Low',
  2: 'Normal',
  3: 'High',
};

export function SessionContextCard({
  sorenessRatings,
  sleepQuality,
  energyLevel,
  activeDisruptions,
  colors,
}: {
  sorenessRatings?: Record<string, number> | null;
  sleepQuality?: number | null;
  energyLevel?: number | null;
  activeDisruptions?: Array<{ disruption_type: string; severity: string }> | null;
  colors: ColorScheme;
}) {
  const soreMuscles = sorenessRatings
    ? Object.entries(sorenessRatings).filter(([, v]) => v >= 3)
    : [];
  const hasSoreness = soreMuscles.length > 0;
  const hasReadiness =
    (sleepQuality != null && sleepQuality !== 2) ||
    (energyLevel != null && energyLevel !== 2);
  const hasDisruptions = activeDisruptions != null && activeDisruptions.length > 0;

  if (!hasSoreness && !hasReadiness && !hasDisruptions) return null;

  const styles = buildStyles(colors);
  const pillColors = getReadinessPillColors(colors);

  return (
    <View style={styles.card}>
      <Text style={styles.header}>Session Context</Text>

      {hasSoreness && (
        <View style={styles.section}>
          <Text style={styles.label}>Soreness</Text>
          <View style={styles.chipRow}>
            {soreMuscles.map(([muscle, rating]) => (
              <View key={muscle} style={styles.sorenessChip}>
                <Text style={styles.sorenessChipText}>
                  {formatMuscle(muscle)} {rating}/5
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {hasReadiness && (
        <View style={styles.section}>
          <Text style={styles.label}>Readiness</Text>
          <View style={styles.chipRow}>
            {sleepQuality != null && sleepQuality !== 2 && (
              <View
                style={[
                  styles.readinessChip,
                  { backgroundColor: pillColors.bg[sleepQuality] },
                ]}
              >
                <Text
                  style={[
                    styles.readinessChipText,
                    { color: pillColors.text[sleepQuality] },
                  ]}
                >
                  Sleep: {READINESS_LABELS[sleepQuality] ?? sleepQuality}
                </Text>
              </View>
            )}
            {energyLevel != null && energyLevel !== 2 && (
              <View
                style={[
                  styles.readinessChip,
                  { backgroundColor: pillColors.bg[energyLevel] },
                ]}
              >
                <Text
                  style={[
                    styles.readinessChipText,
                    { color: pillColors.text[energyLevel] },
                  ]}
                >
                  Energy: {ENERGY_LABELS[energyLevel] ?? energyLevel}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {hasDisruptions && (
        <View style={styles.section}>
          <Text style={styles.label}>Disruptions</Text>
          {activeDisruptions!.map((d, i) => (
            <Text key={i} style={styles.disruptionText}>
              • {formatDisruptionType(d.disruption_type)} ({d.severity})
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function formatMuscle(key: string) {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDisruptionType(type: string) {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 16,
      marginBottom: 20,
    },
    header: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    section: {
      marginBottom: 10,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    chipRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    sorenessChip: {
      backgroundColor: colors.warningMuted,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    sorenessChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.warning,
    },
    readinessChip: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    readinessChipText: {
      fontSize: 13,
      fontWeight: '600',
    },
    disruptionText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 2,
    },
  });
}
