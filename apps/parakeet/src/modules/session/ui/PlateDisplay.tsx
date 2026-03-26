import { StyleSheet, Text, View } from 'react-native';

import { calculatePlates } from '@parakeet/training-engine';
import type { PlateKg } from '@shared/constants/plates';
import { PLATE_COLORS } from '@shared/constants/plates';

import { radii, spacing, typography } from '../../../theme';

function formatPlateKg(kg: number) {
  return kg % 1 === 0 ? `${kg}` : `${kg}`;
}

const plateStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: spacing[2],
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: radii.full,
  },
  numbersText: {
    fontSize: typography.sizes.xs,
    color: '#9CA3AF',
    fontWeight: typography.weights.medium,
  },
});

/**
 * Shows plates-per-side for a given weight, either as colored dots or text.
 *
 * Shared between WarmupSection and SetRow.
 */
export function PlateDisplay({
  weightKg,
  barWeightKg,
  disabledPlates,
  mode = 'numbers',
}: {
  weightKg: number;
  barWeightKg: number;
  disabledPlates?: PlateKg[];
  mode?: 'numbers' | 'colors';
}) {
  if (weightKg <= barWeightKg) return null;
  const available = disabledPlates?.length
    ? ([25, 20, 15, 10, 5, 2.5, 1.25] as PlateKg[]).filter(
        (p) => !disabledPlates.includes(p)
      )
    : undefined;
  const { platesPerSide } = calculatePlates(weightKg, barWeightKg, available);

  if (mode === 'colors') {
    return (
      <View style={plateStyles.row}>
        {platesPerSide.flatMap(({ kg, count }) =>
          Array.from({ length: count }, (_, i) => (
            <View
              key={`${kg}-${i}`}
              style={[plateStyles.dot, { backgroundColor: PLATE_COLORS[kg] }]}
            />
          ))
        )}
      </View>
    );
  }

  const label = platesPerSide
    .map(({ kg, count }) =>
      count > 1 ? `${formatPlateKg(kg)}x${count}` : formatPlateKg(kg)
    )
    .join(' + ');

  return (
    <View style={plateStyles.row}>
      <Text style={plateStyles.numbersText}>{label}</Text>
    </View>
  );
}
