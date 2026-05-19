// @spec docs/features/workout-templates/spec-insertion.md
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  useWorkoutTemplates,
  workoutTemplatesQueries,
} from '@modules/workout-templates';
import type {
  WorkoutTemplateListEntry,
  WorkoutTemplateWithItems,
} from '@modules/workout-templates';
import { useQueryClient } from '@tanstack/react-query';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

interface Props {
  visible: boolean;
  /** Called with the resolved template + items after the user picks one.
   *  Detail is fetched on tap (cached after first read). */
  onConfirm: (template: WorkoutTemplateWithItems) => void;
  onClose: () => void;
}

export function AddWorkoutTemplateModal({
  visible,
  onConfirm,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { data, isLoading } = useWorkoutTemplates();
  const queryClient = useQueryClient();
  const templates = data ?? [];

  async function handleSelect(templateId: string) {
    const detail = await queryClient.fetchQuery(
      workoutTemplatesQueries.detail(templateId)
    );
    if (detail) onConfirm(detail);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Workout</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : templates.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No templates yet.</Text>
              <Text style={styles.emptySubtext}>
                Create one under Settings → Workout Templates.
              </Text>
            </View>
          ) : (
            <FlatList
              data={templates}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => (
                <TemplateRow
                  template={item}
                  onPress={() => handleSelect(item.id)}
                  styles={styles}
                />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function TemplateRow({
  template,
  onPress,
  styles,
}: {
  template: WorkoutTemplateListEntry;
  onPress: () => void;
  styles: ReturnType<typeof buildStyles>;
}) {
  const totalEntries = template.item_count * template.rounds;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.rowName}>{template.name}</Text>
      {template.description ? (
        <Text style={styles.rowDescription} numberOfLines={2}>
          {template.description}
        </Text>
      ) : null}
      <Text style={styles.rowMeta}>
        {template.item_count} {template.item_count === 1 ? 'item' : 'items'} ×{' '}
        {template.rounds} {template.rounds === 1 ? 'round' : 'rounds'} ={' '}
        {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'}
      </Text>
    </TouchableOpacity>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-start',
    },
    sheet: {
      flex: 1,
      backgroundColor: colors.bgSurface,
      borderBottomLeftRadius: radii.lg,
      borderBottomRightRadius: radii.lg,
      maxHeight: '80%',
      paddingBottom: spacing[8],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[5],
      paddingTop: spacing[5],
      paddingBottom: spacing[3],
    },
    title: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    closeBtn: {
      fontSize: typography.sizes.base,
      color: colors.textTertiary,
      padding: spacing[1],
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing[8],
      paddingHorizontal: spacing[6],
    },
    emptyText: {
      fontSize: typography.sizes.base,
      color: colors.textSecondary,
      marginBottom: spacing[2],
    },
    emptySubtext: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    listContent: {
      paddingHorizontal: spacing[5],
    },
    row: {
      padding: spacing[4],
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.bgSurface,
      marginBottom: spacing[3],
    },
    rowName: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing[1],
    },
    rowDescription: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing[2],
    },
    rowMeta: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
  });
}
