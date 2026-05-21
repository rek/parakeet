// @spec docs/features/workout-templates/spec-management.md
import { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { getCatalogEntry } from '@parakeet/training-engine';
import { ExerciseName } from '@shared/ui/ExerciseName';

import type { ColorScheme } from '../../../theme';
import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { WorkoutTemplateItemInput } from '../model/types';

interface Props {
  item: WorkoutTemplateItemInput;
  index: number;
  total: number;
  onChange: (patch: Partial<WorkoutTemplateItemInput>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

export function WorkoutTemplateItemRow({
  item,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const catalogEntry = getCatalogEntry(item.exercise);
  const isTimed = catalogEntry?.type === 'timed';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.nameWrap}>
          <ExerciseName
            name={item.exercise}
            slug={item.exercise_slug}
            nameStyle={styles.name}
          />
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onMoveUp}
            disabled={index === 0}
            style={[styles.iconBtn, index === 0 && styles.iconBtnDisabled]}
            activeOpacity={0.6}
          >
            <Text style={styles.iconText}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onMoveDown}
            disabled={index === total - 1}
            style={[
              styles.iconBtn,
              index === total - 1 && styles.iconBtnDisabled,
            ]}
            activeOpacity={0.6}
          >
            <Text style={styles.iconText}>↓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onRemove}
            style={styles.iconBtn}
            activeOpacity={0.6}
          >
            <Text style={[styles.iconText, styles.removeText]}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.fieldRow}>
        {isTimed ? (
          <NumberField
            label="Duration (s)"
            value={item.duration_seconds}
            onChange={(v) => onChange({ duration_seconds: v })}
            styles={styles}
          />
        ) : (
          <NumberField
            label="Reps"
            value={item.reps}
            onChange={(v) => onChange({ reps: v })}
            styles={styles}
          />
        )}
        <NumberField
          label="Rest (s)"
          value={item.rest_after_seconds}
          onChange={(v) =>
            onChange({ rest_after_seconds: Math.max(0, v ?? 0) })
          }
          styles={styles}
        />
      </View>
    </View>
  );
}

function NumberField({
  label,
  value,
  onChange,
  styles,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value == null ? '' : String(value)}
        onChangeText={(t) => {
          const trimmed = t.trim();
          if (trimmed === '') {
            onChange(null);
            return;
          }
          const parsed = Number.parseInt(trimmed, 10);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        keyboardType="number-pad"
        style={styles.input}
      />
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.bgSurface,
      padding: spacing[3],
      marginBottom: spacing[3],
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing[3],
    },
    nameWrap: {
      flex: 1,
      paddingRight: spacing[2],
    },
    name: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing[1],
    },
    iconBtn: {
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      borderRadius: radii.sm,
      backgroundColor: colors.bgMuted,
    },
    iconBtnDisabled: {
      opacity: 0.3,
    },
    iconText: {
      fontSize: typography.sizes.base,
      color: colors.text,
    },
    removeText: {
      color: colors.danger,
    },
    fieldRow: {
      flexDirection: 'row',
      gap: spacing[3],
    },
    field: {
      flex: 1,
    },
    fieldLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      marginBottom: spacing[1],
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      color: colors.text,
      fontSize: typography.sizes.base,
      backgroundColor: colors.bg,
    },
  });
}
