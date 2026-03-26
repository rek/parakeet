import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MuscleGroup } from '@parakeet/shared-types';
import { MUSCLE_LABELS_COMPACT } from '@shared/constants/training';

import { useTheme } from '../../../theme/ThemeContext';

interface MuscleChipsProps {
  muscles: string[];
}

export function MuscleChips({ muscles }: MuscleChipsProps) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
        chip: {
          backgroundColor: colors.primaryMuted,
          borderRadius: 4,
          paddingHorizontal: 5,
          paddingVertical: 1,
        },
        chipText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
      }),
    [colors]
  );

  if (muscles.length === 0) return null;
  return (
    <View style={styles.chipRow}>
      {muscles.map((m, i) => (
        <View key={`${m}-${i}`} style={styles.chip}>
          <Text style={styles.chipText}>
            {MUSCLE_LABELS_COMPACT[m as MuscleGroup] ?? m}
          </Text>
        </View>
      ))}
    </View>
  );
}
