// @spec docs/features/workout-templates/spec-management.md
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AddExerciseModal } from '@shared/ui/AddExerciseModal';
import { captureException } from '@platform/utils/captureException';
import { router } from 'expo-router';

import type { ColorScheme } from '../../../theme';
import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import {
  useCreateWorkoutTemplate,
  useDeleteWorkoutTemplate,
} from '../hooks/useWorkoutTemplates';
import {
  useReplaceWorkoutTemplateItems,
  useUpdateWorkoutTemplate,
  useWorkoutTemplate,
} from '../hooks/useWorkoutTemplate';
import type { WorkoutTemplateItemInput } from '../model/types';
import { defaultItemForExercise } from '../utils/template-item-defaults';
import { WorkoutTemplateItemRow } from './WorkoutTemplateItemRow';

interface Props {
  /** 'new' for create mode, otherwise the template uuid. */
  templateId: string;
}

export function WorkoutTemplateEditor({ templateId }: Props) {
  const isNew = templateId === 'new';
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const { data: existing, isLoading } = useWorkoutTemplate(
    isNew ? undefined : templateId
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rounds, setRounds] = useState(1);
  const [items, setItems] = useState<WorkoutTemplateItemInput[]>([]);
  const [hydrated, setHydrated] = useState(isNew);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (isNew || hydrated || !existing) return;
    setName(existing.name);
    setDescription(existing.description ?? '');
    setRounds(existing.rounds);
    setItems(
      existing.items.map((it) => ({
        position: it.position,
        exercise: it.exercise,
        duration_seconds: it.duration_seconds,
        reps: it.reps,
        rest_after_seconds: it.rest_after_seconds,
      }))
    );
    setHydrated(true);
  }, [existing, hydrated, isNew]);

  const { createTemplate, isPending: isCreating } = useCreateWorkoutTemplate();
  const { updateTemplate, isPending: isUpdating } = useUpdateWorkoutTemplate(
    isNew ? '' : templateId
  );
  const { replaceItems, isPending: isReplacing } =
    useReplaceWorkoutTemplateItems();
  const { deleteTemplate, isPending: isDeleting } = useDeleteWorkoutTemplate();
  const isBusy = isCreating || isUpdating || isReplacing || isDeleting;

  function reorder(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next.map((item, i) => ({ ...item, position: i }));
    });
  }

  function patchItem(index: number, patch: Partial<WorkoutTemplateItemInput>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function removeItem(index: number) {
    setItems((prev) =>
      prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i }))
    );
  }

  function addItem(exercise: string) {
    setShowPicker(false);
    setItems((prev) => [...prev, defaultItemForExercise(exercise, prev.length)]);
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Give your template a name before saving.');
      return;
    }
    if (rounds < 1) {
      Alert.alert('Rounds must be at least 1.');
      return;
    }
    try {
      if (isNew) {
        const newId = await createTemplate({
          name: trimmedName,
          description: description.trim() || null,
          rounds,
        });
        if (items.length > 0) {
          await replaceItems({ templateId: newId, items });
        }
        router.replace(`/settings/workout-templates/${newId}`);
      } else {
        await updateTemplate({
          name: trimmedName,
          description: description.trim() || null,
          rounds,
        });
        await replaceItems({ templateId, items });
        router.back();
      }
    } catch (err) {
      captureException(err);
      Alert.alert(
        'Save failed',
        err instanceof Error ? err.message : 'Could not save template.'
      );
    }
  }

  function handleDelete() {
    if (isNew) return;
    Alert.alert(
      'Delete template',
      `Delete "${name}"? Anyone using it loses access immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTemplate(templateId);
              router.back();
            } catch (err) {
              captureException(err);
              Alert.alert(
                'Delete failed',
                err instanceof Error ? err.message : 'Could not delete.'
              );
            }
          },
        },
      ]
    );
  }

  if (!isNew && isLoading && !hydrated) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. HIIT — Bike/Ski/Row"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Short summary shown in the picker"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, styles.inputMultiline]}
          multiline
        />

        <Text style={styles.label}>Rounds</Text>
        <TextInput
          value={String(rounds)}
          onChangeText={(t) => {
            const parsed = Number.parseInt(t.trim(), 10);
            if (Number.isFinite(parsed)) setRounds(Math.max(1, parsed));
            else if (t.trim() === '') setRounds(1);
          }}
          keyboardType="number-pad"
          style={[styles.input, styles.inputShort]}
        />

        <Text style={styles.sectionHeader}>Items</Text>

        {items.length === 0 ? (
          <Text style={styles.emptyItems}>
            No items yet. Tap “+ Add Exercise” below.
          </Text>
        ) : (
          items.map((item, idx) => (
            <WorkoutTemplateItemRow
              key={`${item.exercise}-${idx}`}
              item={item}
              index={idx}
              total={items.length}
              onChange={(patch) => patchItem(idx, patch)}
              onMoveUp={() => reorder(idx, -1)}
              onMoveDown={() => reorder(idx, 1)}
              onRemove={() => removeItem(idx)}
            />
          ))
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>+ Add Exercise</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, isBusy && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>
            {isNew ? 'Create Template' : 'Save Changes'}
          </Text>
        </TouchableOpacity>

        {!isNew && (
          <TouchableOpacity
            style={[styles.deleteButton, isBusy && styles.buttonDisabled]}
            onPress={handleDelete}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>Delete Template</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <AddExerciseModal
        visible={showPicker}
        onConfirm={(exercise) => addItem(exercise)}
        onClose={() => setShowPicker(false)}
      />
    </>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing[8],
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing[12],
    },
    label: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: spacing[1],
      marginTop: spacing[3],
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      fontSize: typography.sizes.base,
      color: colors.text,
      backgroundColor: colors.bgSurface,
    },
    inputMultiline: {
      minHeight: 64,
      textAlignVertical: 'top',
    },
    inputShort: {
      width: 80,
    },
    sectionHeader: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
      marginTop: spacing[6],
      marginBottom: spacing[3],
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    emptyItems: {
      color: colors.textTertiary,
      fontSize: typography.sizes.sm,
      paddingVertical: spacing[3],
    },
    addButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing[3],
      alignItems: 'center',
      marginTop: spacing[2],
    },
    addButtonText: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
      fontSize: typography.sizes.base,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing[4],
      borderRadius: radii.md,
      alignItems: 'center',
      marginTop: spacing[6],
    },
    saveButtonText: {
      color: colors.textInverse,
      fontWeight: typography.weights.semibold,
      fontSize: typography.sizes.base,
    },
    deleteButton: {
      paddingVertical: spacing[3],
      alignItems: 'center',
      marginTop: spacing[3],
    },
    deleteButtonText: {
      color: colors.danger,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
}
