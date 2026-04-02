import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { PlateKg } from '@shared/constants/plates';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { FormattedTrace } from '../utils/format-trace';
import { PlateCalculatorSheet } from './PlateCalculatorSheet';
import { PlateDisplay } from './PlateDisplay';
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
  prescriptionTrace?: FormattedTrace | null;
  /**
   * Optional slot rendered on the trailing edge of completed set rows.
   * Use to inject feature-specific icons (e.g. SetVideoIcon) without
   * coupling this module to video-analysis.
   */
  videoIconSlot?: ReactNode;
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
  videoIconSlot,
}: SetRowProps) {
  const { colors } = useTheme();
  const [weightKg, setWeightKg] = useState(plannedWeightKg);
  const [weightText, setWeightText] = useState(
    plannedWeightKg === 0 ? '' : String(plannedWeightKg)
  );
  const [reps, setReps] = useState(plannedReps);
  const [isCompleted, setIsCompleted] = useState(false);
  const [plateSheetVisible, setPlateSheetVisible] = useState(false);

  // RPE is owned by parent (set via floating quick-picker) — derive, don't sync
  const rpe = rpeValue;

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
          alignItems: 'center',
          gap: spacing[2],
          marginTop: spacing[1.5],
        },
        adjustButton: {
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[0.5],
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

  const { displayReps, displayWeightKg, displayWeightText, displayCompleted } =
    resolveSetRowDisplay({
      plannedWeightKg,
      plannedReps,
      localWeightKg: weightKg,
      localWeightText: weightText,
      localReps: reps,
      localIsCompleted: isCompleted,
      isCompletedExternal: isCompletedProp,
    });

  // Stable ref for onUpdate so handlers don't need it as a dependency
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Notify parent directly from event handlers — no effect needed
  // (per https://react.dev/learn/you-might-not-need-an-effect)
  function notifyParent(patch: Partial<SetUpdateData>) {
    if (isCompletedProp) return;
    onUpdateRef.current({
      weightKg: patch.weightKg ?? weightKg,
      reps: patch.reps ?? reps,
      rpe,
      isCompleted: patch.isCompleted ?? isCompleted,
    });
  }

  function handleWeightChange(text: string) {
    setWeightText(text);
    const kg = parseWeightInput(text);
    setWeightKg(kg);
    notifyParent({ weightKg: kg });
  }

  function handleRepsChange(text: string) {
    const parsed = parseInt(text, 10);
    let nextReps: number;
    if (!isNaN(parsed) && parsed >= 0) {
      nextReps = parsed;
    } else if (text === '') {
      nextReps = 0;
    } else {
      return;
    }
    setReps(nextReps);
    notifyParent({ reps: nextReps });
  }

  function handleToggleComplete() {
    const next = !isCompleted;
    setIsCompleted(next);
    notifyParent({ isCompleted: next });
  }

  function handleWeightAdjust(delta: number) {
    const next = Math.max(0, Math.round((weightKg + delta) * 10) / 10);
    setWeightKg(next);
    setWeightText(next === 0 ? '' : String(next));
    notifyParent({ weightKg: next });
  }

  // Timed exercises: round label + duration input (minutes) + mark complete
  if (exerciseType === 'timed') {
    return (
      <View
        style={[styles.wrapper, displayCompleted && styles.wrapperCompleted]}
      >
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
            style={[
              styles.checkButton,
              displayCompleted && styles.checkButtonDone,
            ]}
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
              style={[
                styles.weightInput,
                displayCompleted && styles.inputLocked,
              ]}
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

        {exerciseType !== 'bodyweight' && (
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
        )}

        <TouchableOpacity
          style={[
            styles.checkButton,
            displayCompleted && styles.checkButtonDone,
          ]}
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

        {videoIconSlot}
      </View>

      {/* Second row: adjust buttons + plate calc + trace info */}
      {(!displayCompleted && exerciseType === 'weighted') ||
      prescriptionTrace ? (
        <View style={styles.adjustRow}>
          {prescriptionTrace && <TraceLink trace={prescriptionTrace} />}
          {!displayCompleted && exerciseType === 'weighted' && (
            <>
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
                  onPress={() => setPlateSheetVisible(true)}
                  activeOpacity={0.7}
                >
                  <PlateDisplay
                    weightKg={displayWeightKg}
                    barWeightKg={barWeightKg}
                    disabledPlates={disabledPlates}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      ) : null}

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
