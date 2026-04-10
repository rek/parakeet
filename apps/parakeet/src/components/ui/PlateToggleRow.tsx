import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PLATE_COLORS, PLATE_SIZES_KG } from '@shared/constants/plates';
import type { PlateKg } from '@shared/constants/plates';

import { spacing, typography } from '../../theme';
import type { ColorScheme } from '../../theme';

interface PlateToggleRowProps {
  disabledPlates: PlateKg[];
  onToggle: (plate: PlateKg) => void;
  colors: ColorScheme;
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing[2],
      flexWrap: 'wrap',
    },
    dot: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textSecondary,
    },
    labelEnabled: {
      color: colors.textInverse,
    },
  });
}

export function PlateToggleRow({
  disabledPlates,
  onToggle,
  colors,
}: PlateToggleRowProps) {
  const styles = useMemo(() => buildStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {PLATE_SIZES_KG.map((kg) => {
        const enabled = !disabledPlates.includes(kg);
        return (
          <TouchableOpacity
            key={kg}
            style={[
              styles.dot,
              { borderColor: PLATE_COLORS[kg] },
              enabled && { backgroundColor: PLATE_COLORS[kg] },
            ]}
            onPress={() => onToggle(kg)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, enabled && styles.labelEnabled]}>
              {kg}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
