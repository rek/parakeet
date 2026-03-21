import { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import type { PlateKg } from '@parakeet/training-engine';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { PrescriptionTrace } from '@parakeet/training-engine';

import { PlateCalculatorSheet } from './PlateCalculatorSheet';
import { resolveSetRowDisplay } from './resolveSetRowDisplay';
import { TraceLink } from './TraceLink';
import { parseWeightInput } from './weight-input';

// ── Types ────────────────────────────────────────────────────────────────────

interface SetUpdateData {
  weightKg: number;
  reps: number;
  rpe?: number;
  isCompleted: boolean;
}

export interface SetRowProps {
  setNumber: number;
  plannedWeightKg: number;
  plannedReps: number;
  rpeValue?: number;
  isCompleted?: boolean;
  exerciseType?: 'weighted' | 'bodyweight' | 'timed';
  onUpdate: (data: SetUpdateData) => void;
  onRpePress?: () => void;
  barWeightKg: number;
  disabledPlates: PlateKg[];
  onBarWeightChange: (kg: number) => void;
  onDisabledPlatesChange: (plates: PlateKg[]) => void;
  prescriptionTrace?: PrescriptionTrace | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SetRow({
  setNumber,
  plannedWeightKg,
  plannedReps,
  rpeValue,
  isCompleted: isCompletedProp = false,
  exerciseType = 'weighted',
  onUpdate,
  onRpePress,
  barWeightKg,
  disabledPlates,
  onBarWeightChange,
  onDisabledPlatesChange,
  prescriptionTrace,
}: SetRowProps) {
  const { colors } = useTheme();
  const [weightKg, setWeightKg] = useState(plannedWeightKg);
  const [weightText, setWeightText] = useState(
    plannedWeightKg === 0 ? '' : String(plannedWeightKg)
  );
  const [reps, setReps] = useState(plannedReps);
  const [rpe, setRpe] = useState<number | undefined>(rpeValue);
  const [isCompleted, setIsCompleted] = useState(false);
  const [plateSheetVisible, setPlateSheetVisible] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2.5],
          borderBottomWidth: 1,
          borderBottomColor: colors.borderMuted,
        },
        wrapperCompleted: {
          backgroundColor: colors.successMuted,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[1.5],
        },
        setLabel: {
          width: 48,
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.textSecondary,
        },
        timedLabel: {
          flex: 1,
          fontSize: typography.sizes.sm,
          color: colors.textTertiary,
          fontStyle: 'italic',
        },
        weightInput: {
          width: 70,
          height: 40,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.sm,
          fontSize: typography.sizes.base,
          color: colors.text,
          backgroundColor: colors.bgSurface,
          paddingHorizontal: spacing[1],
        },
        unitText: {
          fontSize: typography.sizes.sm,
          color: colors.textSecondary,
        },
        plateButton: {
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
        },
        multiplyText: {
          fontSize: typography.sizes.base,
          color: colors.textTertiary,
        },
        repsInput: {
          width: 48,
          height: 40,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.sm,
          fontSize: typography.sizes.base,
          color: colors.text,
          backgroundColor: colors.bgSurface,
          paddingHorizontal: spacing[1],
        },
        inputLocked: {
          opacity: 0.5,
          backgroundColor: colors.bgMuted,
        },
        rpeChipDisabled: {
          opacity: 0.35,
        },
        rpeChip: {
          width: 48,
          height: 40,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.sm,
          backgroundColor: colors.bgSurface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        rpeChipFilled: {
          borderColor: colors.primary,
          backgroundColor: colors.primaryMuted,
        },
        rpeChipText: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.text,
        },
        rpeChipPlaceholder: {
          color: colors.textTertiary,
          fontWeight: typography.weights.regular,
        },
        checkButton: {
          width: 44,
          height: 44,
          borderRadius: radii.full,
          borderWidth: 1.5,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: spacing[1],
        },
        checkButtonDone: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        checkButtonText: {
          fontSize: 18,
          color: colors.textTertiary,
          fontWeight: typography.weights.bold,
          lineHeight: 22,
        },
        checkButtonTextDone: {
          color: colors.textInverse,
        },
        adjustRow: {
          flexDirection: 'row',
          gap: spacing[2],
          marginTop: spacing[1.5],
          marginLeft: 54,
        },
        adjustButton: {
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1],
          borderRadius: radii.sm,
          backgroundColor: colors.bgMuted,
          borderWidth: 1,
          borderColor: colors.border,
        },
        adjustButtonText: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.textSecondary,
        },
      }),
    [colors]
  );

  const {
    displayReps,
    displayWeightKg,
    displayWeightText,
    displayCompleted,
  } = resolveSetRowDisplay({
    plannedWeightKg,
    plannedReps,
    localWeightKg: weightKg,
    localWeightText: weightText,
    localReps: reps,
    localIsCompleted: isCompleted,
    isCompletedExternal: isCompletedProp,
  });

  // Report local edits to parent — skip when externally completed (parent already has the data)
  useEffect(() => {
    if (isCompletedProp) return;
    onUpdate({ weightKg: displayWeightKg, reps: displayReps, rpe, isCompleted: displayCompleted });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayWeightKg, displayReps, rpe, displayCompleted, isCompletedProp]);

  // Sync external RPE (e.g. from floating quick-picker) into local state
  useEffect(() => {
    setRpe(rpeValue);
  }, [rpeValue]);

  function handleWeightChange(text: string) {
    setWeightText(text);
    const kg = parseWeightInput(text);
    setWeightKg(kg);
  }

  function handleRepsChange(text: string) {
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setReps(parsed);
    } else if (text === '') {
      setReps(0);
    }
  }

  function handleToggleComplete() {
    setIsCompleted((prev) => !prev);
  }

  function handleWeightAdjust(delta: number) {
    setWeightKg((prev) => {
      const next = Math.max(0, Math.round((prev + delta) * 10) / 10);
      setWeightText(next === 0 ? '' : String(next));
      return next;
    });
  }

  // Timed exercises: round label + duration input (minutes) + mark complete
  if (exerciseType === 'timed') {
    return (
      <View style={[styles.wrapper, displayCompleted && styles.wrapperCompleted]}>
        <View style={styles.row}>
          <Text style={styles.setLabel}>Round {setNumber}</Text>
          <TextInput
            style={[styles.repsInput, displayCompleted && styles.inputLocked]}
            value={displayReps === 0 ? '' : String(displayReps)}
            onChangeText={handleRepsChange}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            placeholder={String(plannedReps)}
            placeholderTextColor={colors.textTertiary}
            textAlign="center"
            editable={!displayCompleted}
          />
          <Text style={styles.unitText}>min</Text>
          <TouchableOpacity
            style={[styles.checkButton, displayCompleted && styles.checkButtonDone]}
            onPress={handleToggleComplete}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.checkButtonText,
                displayCompleted && styles.checkButtonTextDone,
              ]}
            >
              ✓
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, displayCompleted && styles.wrapperCompleted]}>
      {/* Main input row */}
      <View style={styles.row}>
        <Text style={styles.setLabel}>Set {setNumber}</Text>

        {exerciseType !== 'bodyweight' && (
          <>
            <TextInput
              style={[styles.weightInput, displayCompleted && styles.inputLocked]}
              value={displayWeightText}
              onChangeText={handleWeightChange}
              keyboardType="decimal-pad"
              returnKeyType="done"
              selectTextOnFocus
              placeholder={String(plannedWeightKg)}
              placeholderTextColor={colors.textTertiary}
              textAlign="center"
              editable={!displayCompleted}
            />
            <Text style={styles.unitText}>kg</Text>
            <Text style={styles.multiplyText}>×</Text>
          </>
        )}

        <TextInput
          style={[styles.repsInput, displayCompleted && styles.inputLocked]}
          value={displayReps === 0 ? '' : String(displayReps)}
          onChangeText={handleRepsChange}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder={String(plannedReps)}
          placeholderTextColor={colors.textTertiary}
          textAlign="center"
          editable={!displayCompleted}
        />

        <TouchableOpacity
          style={[
            styles.rpeChip,
            rpe !== undefined && styles.rpeChipFilled,
            !displayCompleted && styles.rpeChipDisabled,
          ]}
          onPress={displayCompleted ? onRpePress : undefined}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.rpeChipText,
              rpe === undefined && styles.rpeChipPlaceholder,
            ]}
          >
            {rpe !== undefined ? String(rpe) : 'RPE'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.checkButton, displayCompleted && styles.checkButtonDone]}
          onPress={handleToggleComplete}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.checkButtonText,
              displayCompleted && styles.checkButtonTextDone,
            ]}
          >
            ✓
          </Text>
        </TouchableOpacity>
      </View>

      {prescriptionTrace && <TraceLink trace={prescriptionTrace} />}

      {/* Quick-increment buttons — weighted only */}
      {!displayCompleted && exerciseType === 'weighted' && (
        <View style={styles.adjustRow}>
          <TouchableOpacity
            style={styles.adjustButton}
            onPress={() => handleWeightAdjust(-2.5)}
            activeOpacity={0.7}
          >
            <Text style={styles.adjustButtonText}>−2.5</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.adjustButton}
            onPress={() => handleWeightAdjust(2.5)}
            activeOpacity={0.7}
          >
            <Text style={styles.adjustButtonText}>+2.5</Text>
          </TouchableOpacity>
          {displayWeightKg > 0 && (
            <TouchableOpacity
              style={styles.plateButton}
              onPress={() => setPlateSheetVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="barbell-outline"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      <PlateCalculatorSheet
        visible={plateSheetVisible}
        onClose={() => setPlateSheetVisible(false)}
        targetKg={displayWeightKg}
        barWeightKg={barWeightKg}
        disabledPlates={disabledPlates}
        onBarWeightChange={onBarWeightChange}
        onDisabledPlatesChange={onDisabledPlatesChange}
      />
    </View>
  );
}
