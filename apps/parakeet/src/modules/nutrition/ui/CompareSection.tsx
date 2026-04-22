// @spec docs/features/nutrition/spec-macro-targets.md
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useProtocolBundle, useProtocols } from '../hooks/useNutrition';
import type { FoodStatus } from '../model/types';
import { StatusChip } from './StatusChip';

interface Row {
  name: string;
  category: string;
  byProtocol: Partial<Record<string, { status: FoodStatus; notes: string | null }>>;
}

/**
 * Cross-protocol diff. Loads all protocols and their bundles, then reports:
 *   - Disagreements (same food, different status across protocols)
 *   - Single-protocol foods (candidate to add to the other)
 */
export function CompareSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const { data: protocols, isLoading: protocolsLoading } = useProtocols();
  // Only supports 2+ protocols. Load all bundles (hook-order stable since
  // protocols list is deterministic after load).
  const slugs = useMemo(() => protocols?.map((p) => p.slug) ?? [], [protocols]);
  const bundleA = useProtocolBundle(slugs[0] ?? '');
  const bundleB = useProtocolBundle(slugs[1] ?? '');

  if (protocolsLoading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!protocols || protocols.length < 2) {
    return (
      <Text style={styles.empty}>
        Need at least 2 protocols seeded to compare.
      </Text>
    );
  }

  if (bundleA.isLoading || bundleB.isLoading || !bundleA.data || !bundleB.data) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const a = bundleA.data;
  const b = bundleB.data;
  const rows = buildRows(a, b);

  const disagreements = rows.filter(
    (r) =>
      r.byProtocol[a.protocol.slug] &&
      r.byProtocol[b.protocol.slug] &&
      r.byProtocol[a.protocol.slug]!.status !==
        r.byProtocol[b.protocol.slug]!.status,
  );
  const onlyA = rows.filter(
    (r) => r.byProtocol[a.protocol.slug] && !r.byProtocol[b.protocol.slug],
  );
  const onlyB = rows.filter(
    (r) => r.byProtocol[b.protocol.slug] && !r.byProtocol[a.protocol.slug],
  );

  return (
    <View style={styles.wrap}>
      <Section title="Disagreements" hint="Same food, different verdict." styles={styles}>
        {disagreements.length === 0 ? (
          <Text style={styles.empty}>No overlap disagreements.</Text>
        ) : (
          disagreements.map((r) => (
            <View key={r.name + r.category} style={styles.card}>
              <Text style={styles.foodName}>{r.name}</Text>
              <Text style={styles.category}>{humanize(r.category)}</Text>
              <View style={styles.columns}>
                <ProtocolColumn
                  slug={a.protocol.slug}
                  name={a.protocol.name}
                  entry={r.byProtocol[a.protocol.slug]!}
                  styles={styles}
                />
                <ProtocolColumn
                  slug={b.protocol.slug}
                  name={b.protocol.name}
                  entry={r.byProtocol[b.protocol.slug]!}
                  styles={styles}
                />
              </View>
            </View>
          ))
        )}
      </Section>

      <Section
        title={`Only in ${a.protocol.name}`}
        hint={`Candidates to evaluate for ${b.protocol.name}.`}
        styles={styles}
      >
        {renderOnlyList(onlyA, a.protocol.slug, styles, colors)}
      </Section>

      <Section
        title={`Only in ${b.protocol.name}`}
        hint={`Candidates to evaluate for ${a.protocol.name}.`}
        styles={styles}
      >
        {renderOnlyList(onlyB, b.protocol.slug, styles, colors)}
      </Section>
    </View>
  );
}

function buildRows(
  a: { protocol: { slug: string }; foods: { id: string; displayName: string; category: string; status: FoodStatus; notes: string | null }[] },
  b: { protocol: { slug: string }; foods: { id: string; displayName: string; category: string; status: FoodStatus; notes: string | null }[] },
): Row[] {
  const byKey = new Map<string, Row>();
  const put = (
    slug: string,
    f: { displayName: string; category: string; status: FoodStatus; notes: string | null },
  ) => {
    const key = f.displayName.toLowerCase() + '|' + f.category;
    const existing = byKey.get(key) ?? {
      name: f.displayName,
      category: f.category,
      byProtocol: {},
    };
    existing.byProtocol[slug] = { status: f.status, notes: f.notes };
    byKey.set(key, existing);
  };
  for (const f of a.foods) put(a.protocol.slug, f);
  for (const f of b.foods) put(b.protocol.slug, f);
  return [...byKey.values()].sort((x, y) =>
    x.category === y.category
      ? x.name.localeCompare(y.name)
      : x.category.localeCompare(y.category),
  );
}

function renderOnlyList(
  rows: Row[],
  slug: string,
  styles: ReturnType<typeof buildStyles>,
  _colors: ColorScheme,
) {
  if (rows.length === 0) {
    return <Text style={styles.empty}>Nothing unique.</Text>;
  }
  return (
    <View style={{ gap: spacing[1] }}>
      {rows.map((r) => {
        const entry = r.byProtocol[slug]!;
        return (
          <View key={r.name + r.category} style={styles.minCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.foodName}>{r.name}</Text>
              <Text style={styles.category}>{humanize(r.category)}</Text>
            </View>
            <StatusChip status={entry.status} />
          </View>
        );
      })}
    </View>
  );
}

function ProtocolColumn({
  slug: _slug,
  name,
  entry,
  styles,
}: {
  slug: string;
  name: string;
  entry: { status: FoodStatus; notes: string | null };
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={styles.column}>
      <Text style={styles.columnName}>{name}</Text>
      <StatusChip status={entry.status} />
      {entry.notes ? <Text style={styles.note}>{entry.notes}</Text> : null}
    </View>
  );
}

function Section({
  title,
  hint,
  children,
  styles,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={{ gap: spacing[2] }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionHint}>{hint}</Text>
      {children}
    </View>
  );
}

function humanize(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    wrap: { gap: spacing[5] },
    stateBox: { padding: spacing[6], alignItems: 'center' },
    empty: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    sectionTitle: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
    },
    sectionHint: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontStyle: 'italic',
      marginTop: -spacing[1],
    },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      padding: spacing[3],
      gap: spacing[2],
    },
    minCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: colors.bgSurface,
      borderRadius: radii.sm,
      padding: spacing[3],
    },
    foodName: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    category: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
    },
    columns: { flexDirection: 'row', gap: spacing[2] },
    column: {
      flex: 1,
      gap: spacing[1],
      backgroundColor: colors.bg,
      padding: spacing[2],
      borderRadius: radii.sm,
    },
    columnName: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
    },
    note: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      fontStyle: 'italic',
      lineHeight: typography.sizes.xs * 1.4,
    },
  });
}
