// @spec docs/features/nutrition/spec-ui.md
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type {
  DietSupplement,
  EvidenceGrade,
  NepalSourcing,
  SupplementTier,
} from '../model/types';

const TIER_ORDER: SupplementTier[] = ['core', 'food_sourced', 'optional'];
const TIER_LABEL: Record<SupplementTier, string> = {
  core: 'Core Stack',
  food_sourced: 'Food-Sourced',
  optional: 'Optional / Situational',
};
const SOURCING_LABEL: Record<NepalSourcing, string> = {
  local: 'Local (Nepal)',
  import: 'Import',
  food: 'Food',
  mixed: 'Mixed',
};

type TierFilter = SupplementTier | 'all';
type GradeFilter = EvidenceGrade | 'all';
type SourcingFilter = NepalSourcing | 'all';

const TIER_FILTERS: TierFilter[] = ['all', 'core', 'food_sourced', 'optional'];
const GRADE_FILTERS: GradeFilter[] = ['all', 'A', 'B', 'C'];
const SOURCING_FILTERS: SourcingFilter[] = ['all', 'local', 'import', 'food', 'mixed'];

const TIER_FILTER_LABELS: Record<TierFilter, string> = {
  all: 'All',
  core: 'Core',
  food_sourced: 'Food',
  optional: 'Optional',
};
const GRADE_FILTER_LABELS: Record<GradeFilter, string> = {
  all: 'All',
  A: 'A',
  B: 'B',
  C: 'C',
};
const SOURCING_FILTER_LABELS: Record<SourcingFilter, string> = {
  all: 'All',
  local: 'Local',
  import: 'Import',
  food: 'Food',
  mixed: 'Mixed',
};

export function SupplementSection({
  supplements,
}: {
  supplements: DietSupplement[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all');
  const [sourcingFilter, setSourcingFilter] = useState<SourcingFilter>('all');

  const filtered = useMemo(
    () =>
      supplements.filter((s) => {
        if (tierFilter !== 'all' && s.tier !== tierFilter) return false;
        if (gradeFilter !== 'all' && s.evidenceGrade !== gradeFilter) return false;
        if (sourcingFilter !== 'all' && s.nepalSourcing !== sourcingFilter)
          return false;
        return true;
      }),
    [supplements, tierFilter, gradeFilter, sourcingFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map<SupplementTier, DietSupplement[]>();
    for (const s of filtered) {
      const arr = map.get(s.tier) ?? [];
      arr.push(s);
      map.set(s.tier, arr);
    }
    return TIER_ORDER.filter((t) => map.has(t)).map((t) => ({
      tier: t,
      items: (map.get(t) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }, [filtered]);

  if (supplements.length === 0) {
    return (
      <Text style={styles.empty}>
        No supplements configured for this protocol.
      </Text>
    );
  }

  return (
    <View style={styles.root}>
      <FilterRow
        label="Tier"
        options={TIER_FILTERS}
        labelMap={TIER_FILTER_LABELS}
        selected={tierFilter}
        onSelect={setTierFilter}
        styles={styles}
      />
      <FilterRow
        label="Evidence"
        options={GRADE_FILTERS}
        labelMap={GRADE_FILTER_LABELS}
        selected={gradeFilter}
        onSelect={setGradeFilter}
        styles={styles}
      />
      <FilterRow
        label="Sourcing"
        options={SOURCING_FILTERS}
        labelMap={SOURCING_FILTER_LABELS}
        selected={sourcingFilter}
        onSelect={setSourcingFilter}
        styles={styles}
      />

      {grouped.length === 0 && (
        <Text style={styles.empty}>No supplements match these filters.</Text>
      )}

      {grouped.map(({ tier, items }) => (
        <View key={tier} style={styles.group}>
          <Text style={styles.groupLabel}>{TIER_LABEL[tier]}</Text>
          {items.map((s) => (
            <Card key={s.id} item={s} styles={styles} colors={colors} />
          ))}
        </View>
      ))}
    </View>
  );
}

function FilterRow<T extends string>({
  label,
  options,
  labelMap,
  selected,
  onSelect,
  styles,
}: {
  label: string;
  options: T[];
  labelMap: Record<T, string>;
  selected: T;
  onSelect: (value: T) => void;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={styles.filterBlock}>
      <Text style={styles.filterBlockLabel}>{label}</Text>
      <View style={styles.filterPills}>
        {options.map((opt) => {
          const active = opt === selected;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => onSelect(opt)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.filterPillLabel,
                  active && styles.filterPillLabelActive,
                ]}
              >
                {labelMap[opt]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function Card({
  item,
  styles,
  colors,
}: {
  item: DietSupplement;
  styles: ReturnType<typeof buildStyles>;
  colors: ColorScheme;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.name}</Text>
        {item.evidenceGrade && <EvidenceBadge grade={item.evidenceGrade} />}
      </View>
      {item.dose && <Text style={styles.dose}>{item.dose}</Text>}
      {item.rationale && (
        <Text style={styles.rationale}>{item.rationale}</Text>
      )}
      {(item.foodEquivalent || item.nepalSourcing) && (
        <View style={styles.metaRow}>
          {item.nepalSourcing && (
            <Meta
              label="Sourcing"
              value={SOURCING_LABEL[item.nepalSourcing]}
              styles={styles}
              colors={colors}
            />
          )}
          {item.foodEquivalent && (
            <Meta
              label="Food equiv"
              value={item.foodEquivalent}
              styles={styles}
              colors={colors}
            />
          )}
        </View>
      )}
      {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
    </View>
  );
}

function Meta({
  label,
  value,
  styles,
  colors: _colors,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof buildStyles>;
  colors: ColorScheme;
}) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function EvidenceBadge({ grade }: { grade: EvidenceGrade }) {
  const { colors } = useTheme();
  const bg =
    grade === 'A'
      ? colors.successMuted
      : grade === 'B'
        ? colors.infoMuted
        : colors.warningMuted;
  const fg =
    grade === 'A'
      ? colors.success
      : grade === 'B'
        ? colors.info
        : colors.warning;
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
        }}
      >
        EVIDENCE {grade}
      </Text>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    root: { gap: spacing[5] },
    filterBlock: { gap: spacing[1] },
    filterBlockLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
    },
    filterPills: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
    filterPill: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1.5],
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgSurface,
    },
    filterPillActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    filterPillLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
    },
    filterPillLabelActive: { color: colors.primary },
    group: { gap: spacing[2] },
    groupLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
      marginBottom: spacing[1],
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
    dose: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    rationale: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: typography.sizes.sm * 1.45,
    },
    metaRow: {
      flexDirection: 'row',
      gap: spacing[3],
      flexWrap: 'wrap',
      marginTop: spacing[1],
    },
    meta: { gap: 2 },
    metaLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
    },
    metaValue: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    notes: {
      fontSize: typography.sizes.xs,
      fontStyle: 'italic',
      color: colors.textTertiary,
      lineHeight: typography.sizes.xs * 1.4,
    },
    empty: {
      color: colors.textTertiary,
      fontSize: typography.sizes.sm,
      fontStyle: 'italic',
    },
  });
}
