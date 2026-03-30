import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { LIFT_LABELS } from '@shared/constants';

import type { ColorScheme } from '../../../theme';
import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

export interface SetSelection {
  lift: string;
  setNumber: number;
  cameraAngle: 'side' | 'front';
}

export function PartnerSetPicker({
  lift,
  plannedSets,
  onSelect,
}: {
  lift: string;
  plannedSets: readonly unknown[];
  onSelect: (selection: SetSelection) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const totalSets = plannedSets.length;
  const [selectedSet, setSelectedSet] = useState(1);
  const [angle, setAngle] = useState<'side' | 'front'>('side');

  const liftLabel =
    LIFT_LABELS[lift as keyof typeof LIFT_LABELS] ?? lift;

  return (
    <View style={styles.container}>
      <Text style={styles.liftLabel}>{liftLabel}</Text>

      <Text style={styles.sectionLabel}>Set</Text>
      <View style={styles.setRow}>
        {Array.from({ length: totalSets }, (_, i) => i + 1).map((num) => (
          <TouchableOpacity
            key={num}
            style={[styles.setChip, selectedSet === num && styles.setChipActive]}
            onPress={() => setSelectedSet(num)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.setChipText,
                selectedSet === num && styles.setChipTextActive,
              ]}
            >
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Camera Angle</Text>
      <View style={styles.angleRow}>
        {(['side', 'front'] as const).map((a) => (
          <TouchableOpacity
            key={a}
            style={[styles.angleChip, angle === a && styles.angleChipActive]}
            onPress={() => setAngle(a)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.angleChipText,
                angle === a && styles.angleChipTextActive,
              ]}
            >
              {a === 'side' ? 'Side' : 'Front'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.filmButton}
        onPress={() =>
          onSelect({ lift, setNumber: selectedSet, cameraAngle: angle })
        }
        activeOpacity={0.7}
        accessibilityLabel={`Film set ${selectedSet}`}
        accessibilityRole="button"
      >
        <Text style={styles.filmButtonText}>
          Start Recording — Set {selectedSet}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      padding: spacing[4],
      gap: spacing[4],
    },
    liftLabel: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
    },
    sectionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    setRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    setChip: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    setChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    setChipText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    setChipTextActive: {
      color: colors.primary,
    },
    angleRow: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    angleChip: {
      flex: 1,
      paddingVertical: spacing[2],
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
    },
    angleChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    angleChipText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },
    angleChipTextActive: {
      color: colors.primary,
    },
    filmButton: {
      paddingVertical: spacing[3],
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    filmButtonText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.textInverse,
    },
  });
}
