import { useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useFoodNutrition } from '../hooks/useNutrition';
import type { FoodNutritionRow } from '../model/types';

// ── Gram presets ──────────────────────────────────────────────────────────────

const GRAM_PRESETS = [50, 100, 150, 200] as const;

// ── Macro row ─────────────────────────────────────────────────────────────────

function scale(value: number, grams: number, servingG: number) {
  return (value * grams) / servingG;
}

function fmt(n: number) {
  return n < 10 ? n.toFixed(1) : Math.round(n).toString();
}

// ── Expanded detail ───────────────────────────────────────────────────────────

function FoodDetail({
  item,
  colors,
  styles,
}: {
  item: FoodNutritionRow;
  colors: ColorScheme;
  styles: ReturnType<typeof buildStyles>;
}) {
  const [grams, setGrams] = useState(100);
  const [customText, setCustomText] = useState('');

  const kcal = scale(item.kcal, grams, item.servingG);
  const protein = scale(item.proteinG, grams, item.servingG);
  const fat = scale(item.fatG, grams, item.servingG);
  const carbs = scale(item.carbG, grams, item.servingG);
  const fiber = item.fiberG !== null ? scale(item.fiberG, grams, item.servingG) : null;

  function handleCustomChange(text: string) {
    setCustomText(text);
    const n = parseFloat(text);
    if (Number.isFinite(n) && n > 0 && n <= 2000) {
      setGrams(n);
    }
  }

  function handlePresetPress(g: number) {
    setGrams(g);
    setCustomText('');
  }

  return (
    <View style={styles.detail}>
      {/* Gram selector */}
      <View style={styles.gramRow}>
        {GRAM_PRESETS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.gramPill, grams === g && !customText && styles.gramPillActive]}
            onPress={() => handlePresetPress(g)}
            activeOpacity={0.75}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${g} grams`}
          >
            <Text
              style={[
                styles.gramPillLabel,
                grams === g && !customText && styles.gramPillLabelActive,
              ]}
            >
              {g}g
            </Text>
          </TouchableOpacity>
        ))}
        <TextInput
          style={[styles.gramInput, customText.length > 0 && styles.gramInputActive]}
          placeholder="g"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          value={customText}
          onChangeText={handleCustomChange}
          maxLength={6}
          accessible
          accessibilityLabel="Custom gram amount"
        />
      </View>

      {/* Macro grid */}
      <View style={styles.macroGrid}>
        <MacroCell label="kcal" value={fmt(kcal)} highlight colors={colors} styles={styles} />
        <MacroCell label="Protein" value={`${fmt(protein)}g`} colors={colors} styles={styles} />
        <MacroCell label="Fat" value={`${fmt(fat)}g`} colors={colors} styles={styles} />
        <MacroCell label="Carbs" value={`${fmt(carbs)}g`} colors={colors} styles={styles} />
        {fiber !== null && (
          <MacroCell label="Fiber" value={`${fmt(fiber)}g`} colors={colors} styles={styles} />
        )}
      </View>
    </View>
  );
}

function MacroCell({
  label,
  value,
  highlight = false,
  colors,
  styles,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  colors: ColorScheme;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={[styles.macroCell, highlight && { backgroundColor: colors.primaryMuted }]}>
      <Text style={[styles.macroCellValue, highlight && { color: colors.primary }]}>
        {value}
      </Text>
      <Text style={styles.macroCellLabel}>{label}</Text>
    </View>
  );
}

// ── Food row ──────────────────────────────────────────────────────────────────

function FoodRow({
  item,
  expanded,
  onToggle,
  colors,
  styles,
}: {
  item: FoodNutritionRow;
  expanded: boolean;
  onToggle: () => void;
  colors: ColorScheme;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={styles.foodCard}>
      <TouchableOpacity
        style={styles.foodHeader}
        onPress={onToggle}
        activeOpacity={0.75}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${item.displayName}, ${expanded ? 'collapse' : 'expand'}`}
      >
        <View style={styles.foodHeaderText}>
          <Text style={styles.foodName}>{item.displayName}</Text>
          <Text style={styles.foodMeta}>
            {fmt(item.proteinG)}g P · {fmt(item.carbG)}g C · {fmt(item.fatG)}g F
            {' '}· {fmt(item.kcal)} kcal
          </Text>
        </View>
        <Text style={[styles.chevron, { color: colors.textTertiary }]}>
          {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      {expanded && (
        <FoodDetail item={item} colors={colors} styles={styles} />
      )}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MacroLookupSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { data: foods, isLoading, error } = useFoodNutrition();
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!foods) return [];
    const q = query.trim().toLowerCase();
    if (!q) return foods;
    return foods.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q),
    );
  }, [foods, query]);

  function handleToggle(foodId: string) {
    setExpandedId((prev) => (prev === foodId ? null : foodId));
  }

  if (error) {
    return (
      <View style={styles.state}>
        <Text style={styles.errorText}>Could not load food data</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.state}>
        <Text style={styles.emptyText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TextInput
        placeholder="Search foods…"
        placeholderTextColor={colors.textTertiary}
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setExpandedId(null);
        }}
        style={styles.search}
        accessible
        accessibilityLabel="Search foods"
      />

      {filtered.length === 0 ? (
        <Text style={styles.emptyText}>No foods match "{query}"</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.foodId}
          renderItem={({ item }) => (
            <FoodRow
              item={item}
              expanded={expandedId === item.foodId}
              onToggle={() => handleToggle(item.foodId)}
              colors={colors}
              styles={styles}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
          scrollEnabled={false}
          initialNumToRender={20}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    root: { gap: spacing[3] },
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
    state: { padding: spacing[6], alignItems: 'center' },
    emptyText: {
      color: colors.textTertiary,
      fontSize: typography.sizes.sm,
      fontStyle: 'italic',
    },
    errorText: { color: colors.danger, fontSize: typography.sizes.sm },
    foodCard: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    foodHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      gap: spacing[2],
    },
    foodHeaderText: { flex: 1, gap: spacing[0.5] },
    foodName: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    foodMeta: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
    chevron: { fontSize: typography.sizes.xs },
    detail: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: spacing[3],
      gap: spacing[3],
    },
    gramRow: {
      flexDirection: 'row',
      gap: spacing[2],
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    gramPill: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1.5],
      borderRadius: radii.full ?? 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },
    gramPillActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    gramPillLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    gramPillLabelActive: { color: colors.primary },
    gramInput: {
      width: 56,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1.5],
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      color: colors.text,
      fontSize: typography.sizes.sm,
      textAlign: 'center',
    },
    gramInputActive: { borderColor: colors.primary },
    macroGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    macroCell: {
      flex: 1,
      minWidth: 60,
      backgroundColor: colors.bg,
      borderRadius: radii.sm,
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[2],
      alignItems: 'center',
      gap: spacing[0.5],
    },
    macroCellValue: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    macroCellLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
  });
}
