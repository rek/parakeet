import { StyleSheet, Text, View } from 'react-native';
import { getPrimaryMuscles } from '@modules/program';
import type { MuscleGroup } from '@parakeet/training-engine';
import { MUSCLE_LABELS_COMPACT } from '@shared/constants/training';
import { colors } from '../../theme';

interface MuscleChipsProps {
  exerciseName: string;
}

export function MuscleChips({ exerciseName }: MuscleChipsProps) {
  const muscles = getPrimaryMuscles(exerciseName);
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

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: {
    backgroundColor: colors.primaryMuted,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  chipText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
});
