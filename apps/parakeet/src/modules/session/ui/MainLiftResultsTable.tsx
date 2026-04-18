import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ActualSet, PlannedSet } from '@parakeet/shared-types';
import { weightGramsToKg } from '@shared/utils/weight';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { fmtKg } from '../utils/fmtKg';
import { getActualVsPlannedColor } from '../utils/getActualVsPlannedColor';

const ACTUAL_VS_PLANNED_COLORS = {
  neutral: 'text',
  under: 'warning',
  over: 'success',
} as const;

export function MainLiftResultsTable({
  mainSets,
  plannedSets,
  colors,
  renderSetAccessory,
}: {
  mainSets: ActualSet[];
  plannedSets: PlannedSet[];
  colors: ColorScheme;
  renderSetAccessory?: (set: ActualSet) => ReactNode;
}) {
  if (mainSets.length === 0) return null;

  const styles = buildStyles(colors);
  const plannedBySet = new Map(plannedSets.map((ps) => [ps.set_number, ps]));
  const hasPlan = plannedSets.length > 0;

  return (
    <>
      <Text style={styles.sectionHeader}>Main Lift</Text>
      <View style={styles.setsTable}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableCellSet]}>Set</Text>
          {hasPlan ? (
            <>
              <Text style={[styles.tableCell, styles.tableCellPlan]}>Plan</Text>
              <Text style={[styles.tableCell, styles.tableCellActual]}>
                Actual
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.tableCell, styles.tableCellWeight]}>
                Weight
              </Text>
              <Text style={[styles.tableCell, styles.tableCellReps]}>Reps</Text>
            </>
          )}
          <Text style={[styles.tableCell, styles.tableCellRpe]}>RPE</Text>
          {renderSetAccessory ? <View style={styles.tableCellAccessory} /> : null}
        </View>
        {mainSets.map((set, i) => {
          const planned = hasPlan
            ? plannedBySet.get(set.set_number)
            : undefined;
          const result = getActualVsPlannedColor({ actual: set, planned });
          const actualColor = colors[ACTUAL_VS_PLANNED_COLORS[result]];
          return (
            <View
              key={i}
              style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}
            >
              <Text style={[styles.tableCell, styles.tableCellSet]}>
                {set.set_number}
              </Text>
              {hasPlan ? (
                <>
                  <Text style={[styles.tableCell, styles.tableCellPlan]}>
                    {planned
                      ? `${fmtKg(planned.weight_kg)}×${planned.reps}`
                      : '—'}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.tableCellActual,
                      { color: actualColor },
                    ]}
                  >
                    {`${fmtKg(weightGramsToKg(set.weight_grams))}×${set.reps_completed}`}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.tableCell, styles.tableCellWeight]}>
                    {weightGramsToKg(set.weight_grams).toFixed(1)} kg
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellReps]}>
                    {set.reps_completed}
                  </Text>
                </>
              )}
              <Text style={[styles.tableCell, styles.tableCellRpe]}>
                {set.rpe_actual != null ? set.rpe_actual : '—'}
              </Text>
              {renderSetAccessory ? (
                <View style={styles.tableCellAccessory}>
                  {renderSetAccessory(set)}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
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
    tableCellPlan: { flex: 1, color: colors.textSecondary },
    tableCellActual: { flex: 1 },
    tableCellRpe: {
      width: 48,
      textAlign: 'right',
      color: colors.textSecondary,
    },
    tableCellAccessory: {
      width: 32,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
  });
}
