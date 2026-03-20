import { StyleSheet, Text, View } from 'react-native';

import type { ActualSet } from '@parakeet/shared-types';
import { gramsToKg } from '@parakeet/training-engine';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { capitalize } from '@shared/utils/string';
import { groupAuxSetsByExercise } from '../utils/groupAuxSetsByExercise';

export function AuxResultsTable({
  auxiliarySets,
  colors,
}: {
  auxiliarySets: ActualSet[];
  colors: ColorScheme;
}) {
  const grouped = groupAuxSetsByExercise({ sets: auxiliarySets });
  const entries = Object.entries(grouped);

  if (entries.length === 0) return null;

  const styles = buildStyles(colors);

  return (
    <>
      {entries.map(([exercise, sets]) => {
        const isTimed = sets[0]?.exercise_type === 'timed';
        return (
          <View key={exercise}>
            <Text style={styles.sectionHeader}>
              {capitalize(exercise.replace(/_/g, ' '))}
            </Text>
            <View style={styles.setsTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableCellSet]}>
                  {isTimed ? 'Round' : 'Set'}
                </Text>
                {isTimed ? (
                  <Text style={[styles.tableCell, styles.tableCellWeight]}>
                    Duration
                  </Text>
                ) : (
                  <>
                    <Text style={[styles.tableCell, styles.tableCellWeight]}>
                      Weight
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellReps]}>
                      Reps
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellRpe]}>
                      RPE
                    </Text>
                  </>
                )}
              </View>
              {sets.map((set, i) => (
                <View
                  key={i}
                  style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}
                >
                  <Text style={[styles.tableCell, styles.tableCellSet]}>
                    {set.set_number}
                  </Text>
                  {isTimed ? (
                    <Text style={[styles.tableCell, styles.tableCellWeight]}>
                      {set.reps_completed} min
                    </Text>
                  ) : (
                    <>
                      <Text style={[styles.tableCell, styles.tableCellWeight]}>
                        {gramsToKg(set.weight_grams).toFixed(1)} kg
                      </Text>
                      <Text style={[styles.tableCell, styles.tableCellReps]}>
                        {set.reps_completed}
                      </Text>
                      <Text style={[styles.tableCell, styles.tableCellRpe]}>
                        {set.rpe_actual != null ? set.rpe_actual : '—'}
                      </Text>
                    </>
                  )}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    sectionHeader: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.widest,
      marginBottom: spacing[2],
      marginTop: spacing[2],
    },
    setsTable: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: spacing[5],
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: colors.bgMuted,
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[3],
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: spacing[2.5],
      paddingHorizontal: spacing[3],
    },
    tableRowAlt: { backgroundColor: colors.bgMuted + '55' },
    tableCell: {
      fontSize: typography.sizes.sm,
      color: colors.text,
    },
    tableCellSet: { width: 36, color: colors.textSecondary },
    tableCellWeight: { flex: 1 },
    tableCellReps: { width: 48, textAlign: 'center' },
    tableCellRpe: {
      width: 48,
      textAlign: 'right',
      color: colors.textSecondary,
    },
  });
}
