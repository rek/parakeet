// @spec docs/features/workout-templates/spec-management.md
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { router } from 'expo-router';

import type { ColorScheme } from '../../../theme';
import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useWorkoutTemplates } from '../hooks/useWorkoutTemplates';
import type { WorkoutTemplateListEntry } from '../model/types';

export function WorkoutTemplatesList() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { data, isLoading } = useWorkoutTemplates();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const templates = data ?? [];

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.newButton}
        onPress={() => router.push('/settings/workout-templates/new')}
        activeOpacity={0.8}
      >
        <Text style={styles.newButtonText}>+ New Template</Text>
      </TouchableOpacity>

      {templates.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No templates yet.</Text>
          <Text style={styles.emptySubtext}>
            Tap “+ New Template” to create one. Templates are shared with all
            users.
          </Text>
        </View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TemplateRow template={item} styles={styles} />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function TemplateRow({
  template,
  styles,
}: {
  template: WorkoutTemplateListEntry;
  styles: ReturnType<typeof buildStyles>;
}) {
  const totalEntries = template.item_count * template.rounds;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        router.push(`/settings/workout-templates/${template.id}`)
      }
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
    container: {
      flex: 1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing[8],
    },
    newButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing[4],
      borderRadius: radii.md,
      alignItems: 'center',
      marginBottom: spacing[5],
    },
    newButtonText: {
      color: colors.textInverse,
      fontWeight: typography.weights.semibold,
      fontSize: typography.sizes.base,
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
    emptyState: {
      paddingVertical: spacing[8],
      alignItems: 'center',
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
      paddingHorizontal: spacing[6],
    },
  });
}
