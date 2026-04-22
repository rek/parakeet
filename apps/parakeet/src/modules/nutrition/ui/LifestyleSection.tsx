// @spec docs/features/nutrition/spec-ui.md
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type {
  DietLifestyle,
  LifestyleCategory,
  LifestyleFrequency,
} from '../model/types';

const CATEGORY_ORDER: LifestyleCategory[] = [
  'compression',
  'manual_therapy',
  'movement',
  'sleep',
  'stress',
  'other',
];

const CATEGORY_LABEL: Record<LifestyleCategory, string> = {
  compression: 'Compression',
  manual_therapy: 'Manual Therapy',
  movement: 'Movement',
  sleep: 'Sleep',
  stress: 'Stress & Nervous System',
  other: 'Other',
};

const CATEGORY_ICON: Record<
  LifestyleCategory,
  React.ComponentProps<typeof Ionicons>['name']
> = {
  compression: 'shirt-outline',
  manual_therapy: 'hand-left-outline',
  movement: 'walk-outline',
  sleep: 'moon-outline',
  stress: 'pulse-outline',
  other: 'ellipsis-horizontal-outline',
};

const FREQ_LABEL: Record<LifestyleFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  as_needed: 'As needed',
};

export function LifestyleSection({
  items,
}: {
  items: DietLifestyle[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const grouped = useMemo(() => {
    const map = new Map<LifestyleCategory, DietLifestyle[]>();
    for (const it of items) {
      const arr = map.get(it.category) ?? [];
      arr.push(it);
      map.set(it.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      items: (map.get(c) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }, [items]);

  if (items.length === 0) {
    return (
      <Text style={styles.empty}>
        No lifestyle guidance for this protocol yet.
      </Text>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        Diet alone isn't the protocol. Lymphatic health depends on the full
        stack — compression, manual drainage, low-impact movement, sleep,
        and stress regulation. Tap any item for detail.
      </Text>
      {grouped.map(({ category, items }) => (
        <View key={category} style={styles.group}>
          <View style={styles.groupHeader}>
            <Ionicons
              name={CATEGORY_ICON[category]}
              size={18}
              color={colors.primary}
            />
            <Text style={styles.groupLabel}>{CATEGORY_LABEL[category]}</Text>
          </View>
          {items.map((l) => (
            <Card key={l.id} item={l} styles={styles} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Card({
  item,
  styles,
}: {
  item: DietLifestyle;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.name}</Text>
        <FrequencyBadge frequency={item.frequency} />
      </View>
      {item.description && (
        <Text style={styles.description}>{item.description}</Text>
      )}
      {item.rationale && (
        <Text style={styles.rationale}>{item.rationale}</Text>
      )}
    </View>
  );
}

function FrequencyBadge({ frequency }: { frequency: LifestyleFrequency }) {
  const { colors } = useTheme();
  const bg =
    frequency === 'daily'
      ? colors.primaryMuted
      : frequency === 'weekly'
        ? colors.infoMuted
        : colors.bgSurface;
  const fg =
    frequency === 'daily'
      ? colors.primary
      : frequency === 'weekly'
        ? colors.info
        : colors.textSecondary;
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 4,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[0.5],
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.bold,
          letterSpacing: typography.letterSpacing.wider,
          textTransform: 'uppercase',
        }}
      >
        {FREQ_LABEL[frequency]}
      </Text>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    root: { gap: spacing[5] },
    intro: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: typography.sizes.sm * 1.5,
      fontStyle: 'italic',
    },
    group: { gap: spacing[2] },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      marginBottom: spacing[1],
    },
    groupLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
    },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      padding: spacing[4],
      gap: spacing[2],
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing[2],
    },
    name: {
      flex: 1,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    description: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: typography.sizes.sm * 1.45,
    },
    rationale: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontStyle: 'italic',
      lineHeight: typography.sizes.xs * 1.5,
    },
    empty: {
      color: colors.textTertiary,
      fontSize: typography.sizes.sm,
      fontStyle: 'italic',
    },
  });
}
