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
  /** Canonical current weight (from store). SetRow displays this directly. */
  weightKg: number;
  /** Canonical current reps (from store). */
  reps: number;
  /** Original prescription, used as input placeholder only. */
  placeholderWeightKg?: number;
  placeholderReps?: number;
  /** Rep range from the prescription (e.g. [3, 5] for Block 3 Rep day). Shown as a hint. */
  repsRange?: [number, number];
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

function formatWeightText(kg: number): string {
  return kg === 0 ? '' : String(kg);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SetRow({
  setNumber,
  weightKg,
  reps,
  placeholderWeightKg,
  placeholderReps,
  repsRange,
  rpeValue,
  isCompleted = false,
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

  // Local text buffer for in-progress typing ("5.", ""). The numeric value is
  // canonical from props; this just preserves keystrokes that haven't yet
  // resolved to a different number.
  const [weightText, setWeightText] = useState(() => formatWeightText(weightKg));

  // Resync buffer when canonical weight changes externally (e.g. +5kg accept,
  // ±2.5 button on another render path). Skip resync if the current buffer
  // already parses to the new weight — that means the change came from this
  // input's own onChange, so the user's keystroke ("5.") must not be wiped.
  const lastWeightRef = useRef(weightKg);
  if (lastWeightRef.current !== weightKg) {
    lastWeightRef.current = weightKg;
    if (parseWeightInput(weightText) !== weightKg) {
      setWeightText(formatWeightText(weightKg));
    }
  }

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
        repsRangeHint: {
          fontSize: typography.sizes.xs,
          color: colors.textTertiary,
          marginLeft: spacing[1],
        },
      }),
    [colors]
  );

  // Stable ref for onUpdate so handlers can be defined without closing over
  // a possibly-changing parent callback.
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  function emit(patch: Partial<SetUpdateData>) {
    if (isCompleted && patch.isCompleted !== false) {
      // Completed sets are read-only except via toggle-off
      return;
    }
    onUpdateRef.current({
      weightKg: patch.weightKg ?? weightKg,
      reps: patch.reps ?? reps,
      rpe: rpeValue,
      isCompleted: patch.isCompleted ?? isCompleted,
    });
  }

  function handleWeightChange(text: string) {
    setWeightText(text);
    const kg = parseWeightInput(text);
    if (kg !== weightKg) emit({ weightKg: kg });
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
    if (nextReps !== reps) emit({ reps: nextReps });
  }

  function handleToggleComplete() {
    onUpdateRef.current({
      weightKg,
      reps,
      rpe: rpeValue,
      isCompleted: !isCompleted,
    });
  }

  function handleWeightAdjust(delta: number) {
    const next = Math.max(0, Math.round((weightKg + delta) * 10) / 10);
    if (next !== weightKg) emit({ weightKg: next });
  }

  // Timed exercises: round label + duration input (minutes) + mark complete
  if (exerciseType === 'timed') {
    return (
      <View style={[styles.wrapper, isCompleted && styles.wrapperCompleted]}>
        <View style={styles.row}>
          <Text style={styles.setLabel}>Round {setNumber}</Text>
          <TextInput
            style={[styles.repsInput, isCompleted && styles.inputLocked]}
            value={reps === 0 ? '' : String(reps)}
            onChangeText={handleRepsChange}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            placeholder={String(placeholderReps ?? reps)}
            placeholderTextColor={colors.textTertiary}
            textAlign="center"
            editable={!isCompleted}
          />
          <Text style={styles.unitText}>min</Text>
          <TouchableOpacity
            style={[styles.checkButton, isCompleted && styles.checkButtonDone]}
            onPress={handleToggleComplete}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.checkButtonText,
                isCompleted && styles.checkButtonTextDone,
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
    <View style={[styles.wrapper, isCompleted && styles.wrapperCompleted]}>
      {/* Main input row */}
      <View style={styles.row}>
        <Text style={styles.setLabel}>Set {setNumber}</Text>

        {exerciseType !== 'bodyweight' && (
          <>
            <TextInput
              style={[styles.weightInput, isCompleted && styles.inputLocked]}
              value={weightText}
              onChangeText={handleWeightChange}
              keyboardType="decimal-pad"
              returnKeyType="done"
              selectTextOnFocus
              placeholder={String(placeholderWeightKg ?? weightKg)}
              placeholderTextColor={colors.textTertiary}
              textAlign="center"
              editable={!isCompleted}
            />
            <Text style={styles.unitText}>kg</Text>
            <Text style={styles.multiplyText}>×</Text>
          </>
        )}

        <TextInput
          style={[styles.repsInput, isCompleted && styles.inputLocked]}
          value={reps === 0 ? '' : String(reps)}
          onChangeText={handleRepsChange}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder={String(placeholderReps ?? reps)}
          placeholderTextColor={colors.textTertiary}
          textAlign="center"
          editable={!isCompleted}
        />

        {repsRange && !isCompleted && (
          <Text style={styles.repsRangeHint}>
            {repsRange[0]}–{repsRange[1]}
          </Text>
        )}

        {exerciseType !== 'bodyweight' && (
          <TouchableOpacity
            style={[
              styles.rpeChip,
              rpeValue !== undefined && styles.rpeChipFilled,
              !isCompleted && styles.rpeChipDisabled,
            ]}
            onPress={isCompleted ? onRpePress : undefined}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.rpeChipText,
                rpeValue === undefined && styles.rpeChipPlaceholder,
              ]}
            >
              {rpeValue !== undefined ? String(rpeValue) : 'RPE'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.checkButton, isCompleted && styles.checkButtonDone]}
          onPress={handleToggleComplete}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.checkButtonText,
              isCompleted && styles.checkButtonTextDone,
            ]}
          >
            ✓
          </Text>
        </TouchableOpacity>

        {videoIconSlot}
      </View>

      {/* Second row: adjust buttons + plate calc + trace info */}
      {(!isCompleted && exerciseType === 'weighted') || prescriptionTrace ? (
        <View style={styles.adjustRow}>
          {prescriptionTrace && <TraceLink trace={prescriptionTrace} />}
          {!isCompleted && exerciseType === 'weighted' && (
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
              {weightKg > 0 && (
                <TouchableOpacity
                  onPress={() => setPlateSheetVisible(true)}
                  activeOpacity={0.7}
                >
                  <PlateDisplay
                    weightKg={weightKg}
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
        targetKg={weightKg}
        barWeightKg={barWeightKg}
        disabledPlates={disabledPlates}
        onBarWeightChange={onBarWeightChange}
        onDisabledPlatesChange={onDisabledPlatesChange}
      />
    </View>
  );
}
