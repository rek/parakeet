import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Lift } from '@parakeet/shared-types';
import { getAllExercises } from '../lib/exercise-lookup';
import type {
  ExerciseCatalogEntry,
  MuscleGroup,
} from '@parakeet/training-engine';
import { MUSCLE_LABELS_COMPACT } from '@shared/constants/training';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

type SectionFilter = 'all' | Lift | 'general';

const SECTION_LABELS: Record<string, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
  general: 'General',
};

const FILTER_OPTIONS: { key: SectionFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'squat', label: 'Squat' },
  { key: 'bench', label: 'Bench' },
  { key: 'deadlift', label: 'Deadlift' },
  { key: 'general', label: 'General' },
];

interface Props {
  visible: boolean;
  onConfirm: (exercise: string) => void;
  onClose: () => void;
  /** Pre-selects a lift section filter when the modal opens. */
  defaultLift?: Lift;
  /** Exercises already in the user's pool — shown greyed out, not tappable. */
  excludeNames?: string[];
  /** Exercises to show in a "Suggested" section at the top of the list. */
  suggestedNames?: string[];
  /** Recently-used exercises shown in a "Recent" section (below Suggested). */
  recentNames?: string[];
}

interface ListItem {
  type: 'header' | 'exercise' | 'custom';
  key: string;
  label?: string;
  entry?: ExerciseCatalogEntry;
  customName?: string;
  excluded?: boolean;
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
    searchInput: {
      marginHorizontal: spacing[5],
      marginBottom: spacing[3],
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      fontSize: typography.sizes.base,
      color: colors.text,
      backgroundColor: colors.bgSurface,
    },
    list: {
      flex: 1,
      paddingHorizontal: spacing[5],
    },
    sectionHeader: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: spacing[4],
      marginBottom: spacing[1],
    },
    filterRow: {
      flexGrow: 0,
      marginBottom: spacing[2],
    },
    filterRowContent: {
      paddingHorizontal: spacing[5],
      gap: spacing[2],
    },
    filterPill: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgSurface,
    },
    filterPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterPillText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
    },
    filterPillTextActive: {
      color: colors.textInverse,
    },
    exerciseRow: {
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    exerciseRowExcluded: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      opacity: 0.45,
    },
    exerciseRowInner: {
      flex: 1,
    },
    addedLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontWeight: typography.weights.medium,
      paddingTop: 3,
      marginLeft: spacing[2],
    },
    exerciseName: {
      fontSize: typography.sizes.base,
      color: colors.text,
      fontWeight: typography.weights.medium,
      marginBottom: spacing[1],
    },
    exerciseNameExcluded: {
      color: colors.textSecondary,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[1],
    },
    chip: {
      backgroundColor: colors.bgMuted,
      borderRadius: radii.full,
      paddingHorizontal: spacing[2],
      paddingVertical: 2,
    },
    chipText: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
    },
    customRow: {
      paddingVertical: spacing[4],
      marginTop: spacing[3],
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'center',
    },
    customText: {
      fontSize: typography.sizes.base,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
  });
}

export function AddExerciseModal({
  visible,
  onConfirm,
  onClose,
  defaultLift,
  excludeNames,
  suggestedNames,
  recentNames,
}: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [liftFilter, setLiftFilter] = useState<SectionFilter>(
    defaultLift ?? 'all'
  );

  const styles = useMemo(() => buildStyles(colors), [colors]);
  const allExercises = useMemo(() => getAllExercises(), []);

  const listItems = useMemo((): ListItem[] => {
    const q = query.trim().toLowerCase();

    let filtered = allExercises;
    if (q) {
      filtered = filtered.filter((e) => e.name.toLowerCase().includes(q));
    }
    if (liftFilter !== 'all') {
      filtered = filtered.filter((e) =>
        liftFilter === 'general'
          ? e.associatedLift === null
          : e.associatedLift === liftFilter
      );
    }

    const byLift: Record<string, ExerciseCatalogEntry[]> = {
      squat: [],
      bench: [],
      deadlift: [],
      general: [],
    };
    for (const entry of filtered) {
      const key = entry.associatedLift ?? 'general';
      byLift[key].push(entry);
    }

    const sections =
      liftFilter === 'all'
        ? ['squat', 'bench', 'deadlift', 'general']
        : [liftFilter];

    const items: ListItem[] = [];

    // Suggested section — shown at top when no search query is active
    if (!q && suggestedNames && suggestedNames.length > 0) {
      const suggestedEntries = suggestedNames
        .map((name) => allExercises.find((e) => e.name === name))
        .filter((e): e is ExerciseCatalogEntry => e != null);
      if (suggestedEntries.length > 0) {
        items.push({
          type: 'header',
          key: 'header-suggested',
          label: 'Suggested',
        });
        for (const entry of suggestedEntries) {
          items.push({
            type: 'exercise',
            key: `suggested-${entry.name}`,
            entry,
            excluded: excludeNames?.includes(entry.name) ?? false,
          });
        }
      }
    }

    // Recent section — shown below Suggested when no search query
    if (!q && recentNames && recentNames.length > 0) {
      const suggestedSet = new Set(suggestedNames ?? []);
      const recentEntries = recentNames
        .filter((name) => !suggestedSet.has(name))
        .map((name) => allExercises.find((e) => e.name === name))
        .filter((e): e is ExerciseCatalogEntry => e != null);
      if (recentEntries.length > 0) {
        items.push({ type: 'header', key: 'header-recent', label: 'Recent' });
        for (const entry of recentEntries) {
          items.push({
            type: 'exercise',
            key: `recent-${entry.name}`,
            entry,
            excluded: excludeNames?.includes(entry.name) ?? false,
          });
        }
      }
    }

    for (const lift of sections) {
      const group = byLift[lift] ?? [];
      if (group.length === 0) continue;
      // Only show section headers when showing multiple sections
      if (liftFilter === 'all') {
        items.push({
          type: 'header',
          key: `header-${lift}`,
          label: SECTION_LABELS[lift],
        });
      }
      for (const entry of group) {
        items.push({
          type: 'exercise',
          key: entry.name,
          entry,
          excluded: excludeNames?.includes(entry.name) ?? false,
        });
      }
    }

    // Custom fallback — only shown when query is non-empty and doesn't match any catalog name exactly
    const trimmed = query.trim();
    const exactMatch = trimmed
      ? allExercises.some((e) => e.name.toLowerCase() === trimmed.toLowerCase())
      : true;
    if (trimmed && !exactMatch) {
      items.push({ type: 'custom', key: 'custom', customName: trimmed });
    }

    return items;
  }, [
    query,
    liftFilter,
    allExercises,
    excludeNames,
    suggestedNames,
    recentNames,
  ]);

  function handleSelect(name: string) {
    onConfirm(name);
    setQuery('');
    setLiftFilter(defaultLift ?? 'all');
  }

  function handleClose() {
    setQuery('');
    setLiftFilter(defaultLift ?? 'all');
    onClose();
  }

  function renderExerciseChips(entry: ExerciseCatalogEntry) {
    if (entry.primaryMuscles.length === 0) return null;
    return (
      <View style={styles.chipRow}>
        {entry.primaryMuscles.map((m) => (
          <View key={m} style={styles.chip}>
            <Text style={styles.chipText}>
              {MUSCLE_LABELS_COMPACT[m as MuscleGroup] ?? m}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  function renderItem({ item }: { item: ListItem }) {
    if (item.type === 'header') {
      return <Text style={styles.sectionHeader}>{item.label}</Text>;
    }
    if (item.type === 'custom') {
      return (
        <TouchableOpacity
          style={styles.customRow}
          onPress={() => handleSelect(item.customName!)}
          activeOpacity={0.7}
        >
          <Text style={styles.customText}>Add "{item.customName}"</Text>
        </TouchableOpacity>
      );
    }
    const entry = item.entry!;
    if (item.excluded) {
      return (
        <View style={[styles.exerciseRow, styles.exerciseRowExcluded]}>
          <View style={styles.exerciseRowInner}>
            <Text style={[styles.exerciseName, styles.exerciseNameExcluded]}>
              {entry.name}
            </Text>
            {renderExerciseChips(entry)}
          </View>
          <Text style={styles.addedLabel}>Added</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.exerciseRow}
        onPress={() => handleSelect(entry.name)}
        activeOpacity={0.7}
      >
        <Text style={styles.exerciseName}>{entry.name}</Text>
        {renderExerciseChips(entry)}
      </TouchableOpacity>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      >
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Exercise</Text>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search or type a custom name…"
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional for modal UX
            autoFocus
            returnKeyType="search"
            autoCapitalize="words"
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={styles.filterRowContent}
            keyboardShouldPersistTaps="handled"
          >
            {FILTER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.filterPill,
                  liftFilter === opt.key && styles.filterPillActive,
                ]}
                onPress={() => setLiftFilter(opt.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    liftFilter === opt.key && styles.filterPillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={listItems}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
