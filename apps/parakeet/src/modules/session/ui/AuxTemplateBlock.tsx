// @spec docs/features/workout-templates/spec-insertion.md
import { useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { type PlateKg } from '@shared/constants/plates';
import { ExerciseName } from '@shared/ui/ExerciseName';
import { weightGramsToKg } from '@shared/utils/weight';

import type { ColorScheme } from '../../../theme';
import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { AuxiliaryActualSet } from '../store/sessionStore';
import { annotateTemplateRounds } from '../utils/annotateTemplateRounds';
import { SetRow } from './SetRow';

interface SetUpdateData {
  weightKg: number;
  reps: number;
  rpe?: number;
  isCompleted: boolean;
}

interface Props {
  /** Entries in this block, in expansion order (round-by-round). All entries
   *  share the same template_instance_id. */
  block: ReadonlyArray<AuxiliaryActualSet>;
  /** Full session-wide aux array. Needed so `setsInExercise` reflects the
   *  exercise's session-global count, not just the block's count — otherwise
   *  the rest-timer "last set" gate trips early when a template exercise
   *  overlaps with pre-existing ad-hoc sets. */
  auxiliarySets: ReadonlyArray<AuxiliaryActualSet>;
  /** Confirm and remove the whole block. */
  onRemoveBlock: () => void;
  /** Forwarded to each entry's SetRow. */
  onAuxSetUpdate: (
    exercise: string,
    setNumber: number,
    setsInExercise: number,
    data: SetUpdateData
  ) => void;
  onAuxRpePress: (exercise: string, setNumber: number) => void;
  barWeightKg: number;
  disabledPlates: PlateKg[];
  onBarWeightChange: (kg: number) => void;
  onDisabledPlatesChange: (plates: PlateKg[]) => void;
}

export function AuxTemplateBlock({
  block,
  auxiliarySets,
  onRemoveBlock,
  onAuxSetUpdate,
  onAuxRpePress,
  barWeightKg,
  disabledPlates,
  onBarWeightChange,
  onDisabledPlatesChange,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const annotated = useMemo(
    () => annotateTemplateRounds(block, auxiliarySets),
    [block, auxiliarySets]
  );
  const templateName = block[0]?.template_name ?? 'Workout Block';

  function confirmRemove() {
    Alert.alert(
      'Remove workout block?',
      `This drops all ${block.length} entries from "${templateName}" out of this session. Any sets you've already logged stay in your history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onRemoveBlock },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerLabel}>Workout</Text>
          <Text style={styles.headerTitle}>{templateName}</Text>
        </View>
        <TouchableOpacity
          onPress={confirmRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Remove workout block"
          accessibilityRole="button"
        >
          <Text style={styles.removeBtn}>✕</Text>
        </TouchableOpacity>
      </View>
      {annotated.map(({ entry, round, totalRounds, setsInExercise }) => (
        <View
          key={`${entry.exercise}-${entry.set_number}`}
          style={styles.entryRow}
        >
          <View style={styles.entryHeader}>
            <Text style={styles.roundBadge}>
              Round {round}/{totalRounds}
            </Text>
            <ExerciseName
              name={entry.exercise}
              nameStyle={styles.entryExerciseName}
            />
          </View>
          <SetRow
            setNumber={entry.set_number}
            weightKg={weightGramsToKg(entry.weight_grams)}
            reps={entry.reps_completed}
            rpeValue={entry.rpe_actual}
            isCompleted={entry.is_completed}
            exerciseType={entry.exercise_type}
            onRpePress={() => onAuxRpePress(entry.exercise, entry.set_number)}
            onUpdate={(data) =>
              onAuxSetUpdate(
                entry.exercise,
                entry.set_number,
                setsInExercise,
                data
              )
            }
            barWeightKg={barWeightKg}
            disabledPlates={disabledPlates}
            onBarWeightChange={onBarWeightChange}
            onDisabledPlatesChange={onDisabledPlatesChange}
          />
        </View>
      ))}
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      marginHorizontal: spacing[4],
      marginVertical: spacing[3],
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radii.md,
      backgroundColor: colors.bgSurface,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
      backgroundColor: colors.bgMuted,
    },
    headerTextWrap: {
      flex: 1,
      paddingRight: spacing[2],
    },
    headerLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontWeight: typography.weights.semibold,
    },
    headerTitle: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginTop: 2,
    },
    removeBtn: {
      fontSize: typography.sizes.lg,
      color: colors.danger,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
    },
    entryRow: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    entryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing[1],
      gap: spacing[2],
    },
    roundBadge: {
      fontSize: typography.sizes.xs,
      color: colors.textInverse,
      backgroundColor: colors.primary,
      borderRadius: radii.full,
      paddingHorizontal: spacing[2],
      paddingVertical: 2,
      fontWeight: typography.weights.semibold,
      overflow: 'hidden',
    },
    entryExerciseName: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      flex: 1,
    },
  });
}
