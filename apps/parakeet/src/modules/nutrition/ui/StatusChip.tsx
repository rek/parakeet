import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { FoodStatus } from '../model/types';

const LABELS: Record<FoodStatus, string> = {
  yes: 'Yes',
  caution: 'Caution',
  no: 'No',
};

export function StatusChip({ status }: { status: FoodStatus }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  return (
    <View style={[styles.chip, styles[status]]}>
      <Text style={[styles.label, styles[`${status}Label` as const]]}>
        {LABELS[status]}
      </Text>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    chip: {
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[0.5],
      borderRadius: radii.sm,
      alignSelf: 'flex-start',
    },
    label: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      letterSpacing: typography.letterSpacing.wide,
      textTransform: 'uppercase',
    },
    yes: { backgroundColor: colors.successMuted },
    yesLabel: { color: colors.success },
    caution: { backgroundColor: colors.warningMuted },
    cautionLabel: { color: colors.warning },
    no: { backgroundColor: colors.dangerMuted },
    noLabel: { color: colors.danger },
  });
}
