// @spec docs/features/nutrition/spec-ui.md
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { DietFood, FoodStatus } from '../model/types';
import { StatusChip } from './StatusChip';

type Filter = FoodStatus | 'all';

const FILTERS: Filter[] = ['all', 'yes', 'caution', 'no'];
const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  yes: 'Yes',
  caution: 'Caution',
  no: 'No',
};

export function FoodSection({ foods }: { foods: DietFood[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods
      .filter((f) => (filter === 'all' ? true : f.status === filter))
      .filter((f) =>
        q.length === 0
          ? true
          : f.displayName.toLowerCase().includes(q) ||
            f.category.toLowerCase().includes(q) ||
            (f.notes ?? '').toLowerCase().includes(q),
      );
  }, [foods, filter, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, DietFood[]>();
    for (const f of filtered) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      }));
  }, [filtered]);

  return (
    <View style={styles.root}>
      <TextInput
        placeholder="Search foods…"
        placeholderTextColor={colors.textTertiary}
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.filterLabel,
                  active && styles.filterLabelActive,
                ]}
              >
                {FILTER_LABELS[f]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {grouped.length === 0 && (
        <Text style={styles.empty}>No foods match this filter.</Text>
      )}

      {grouped.map(({ category, items }) => (
        <View key={category} style={styles.group}>
          <Text style={styles.groupLabel}>{humanize(category)}</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.displayName}</Text>
                <StatusChip status={item.status} />
              </View>
              {item.notes ? (
                <Text style={styles.itemNotes}>{item.notes}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function humanize(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    root: { gap: spacing[4] },
    search: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      color: colors.text,
      fontSize: typography.sizes.base,
    },
    filters: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
    filterPill: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1.5],
      borderRadius: radii.full ?? 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgSurface,
    },
    filterPillActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    filterLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
    },
    filterLabelActive: { color: colors.primary },
    empty: {
      color: colors.textTertiary,
      fontSize: typography.sizes.sm,
      fontStyle: 'italic',
    },
    group: { gap: spacing[2] },
    groupLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
    },
    item: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      padding: spacing[3],
      gap: spacing[1],
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing[2],
    },
    itemName: {
      flex: 1,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    itemNotes: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: typography.sizes.sm * 1.4,
    },
  });
}
