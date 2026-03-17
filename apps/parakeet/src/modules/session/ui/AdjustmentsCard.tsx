import { StyleSheet, Text, View } from 'react-native';

import type { ColorScheme } from '../../../theme';
import type { VolumeReductions } from '../model/types';

const SOURCE_LABELS: Record<string, string> = {
  soreness: 'Soreness',
  readiness: 'Readiness',
  cycle_phase: 'Cycle phase',
  disruption: 'Disruption',
};

export function AdjustmentsCard({
  volumeReductions,
  intensityModifier,
  rationale,
  colors,
}: {
  volumeReductions?: VolumeReductions;
  intensityModifier?: number;
  rationale?: string[];
  colors: ColorScheme;
}) {
  const hasVolumeChange =
    volumeReductions != null && volumeReductions.totalSetsRemoved > 0;
  const hasIntensityChange =
    intensityModifier != null && intensityModifier < 1;
  const hasRationale = rationale != null && rationale.length > 0;

  if (!hasVolumeChange && !hasIntensityChange) return null;

  const styles = buildStyles(colors);
  const adjustedSets = hasVolumeChange
    ? volumeReductions!.baseSetsCount - volumeReductions!.totalSetsRemoved
    : null;

  return (
    <View style={styles.card}>
      <Text style={styles.header}>Today's Adjustments</Text>

      {hasVolumeChange && (
        <View style={styles.row}>
          <Text style={styles.volumeText}>
            {volumeReductions!.baseSetsCount} → {adjustedSets} sets
          </Text>
          <View style={styles.chipRow}>
            {volumeReductions!.sources.map((s) => (
              <View key={s.source} style={styles.chip}>
                <Text style={styles.chipText}>
                  {SOURCE_LABELS[s.source] ?? s.source} −{s.setsRemoved}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {hasIntensityChange && (
        <View style={styles.row}>
          <Text style={styles.intensityText}>
            Intensity at {Math.round(intensityModifier! * 100)}%
          </Text>
        </View>
      )}

      {hasRationale && (
        <View style={styles.rationaleSection}>
          {rationale!.map((r, i) => (
            <Text key={i} style={styles.rationaleItem}>
              • {r}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
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
      marginBottom: 32,
    },
    header: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    row: {
      marginBottom: 8,
    },
    volumeText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    chipRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    chip: {
      backgroundColor: colors.warningMuted,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.warning,
    },
    intensityText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.warning,
    },
    rationaleSection: {
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    rationaleItem: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 2,
    },
  });
}
