import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useMacroTargets } from '../hooks/useMacroTargets';
import type { DietProtocolSlug } from '../lib/macro-targets';

/**
 * Daily macro + kcal target card, protocol-driven.
 *
 * Uses the lifter's current profile (bodyweight / sex / DOB) and the
 * selected protocol's macro split. Height + lean-mass + activity +
 * goal fields are not yet in the Profile service — the underlying
 * `computeMacroTargets` falls back to bodyweight-only BMR and raises
 * `low_confidence`, which surfaces here as a "rough estimate" badge
 * and a CTA to complete the profile.
 */
export function MacroTargetsCard({
  protocol,
}: {
  protocol: DietProtocolSlug;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { target, missing, isLoading } = useMacroTargets(protocol);

  if (isLoading) return null;

  if (missing.length > 0 || !target) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.header}>Your targets today</Text>
        <View style={styles.emptyCard}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.textTertiary}
          />
          <Text style={styles.emptyText}>
            Add {humanizeMissing(missing)} in your profile to see daily
            macro targets.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.header}>Your targets today</Text>
        {target.low_confidence ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>rough estimate</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.card}>
        <View style={styles.kcalRow}>
          <Text style={styles.kcalValue}>{target.kcal}</Text>
          <Text style={styles.kcalUnit}>kcal</Text>
        </View>

        <View style={styles.macroRow}>
          <MacroStat label="Protein" value={target.protein_g} styles={styles} />
          <MacroStat label="Fat" value={target.fat_g} styles={styles} />
          <MacroStat
            label={protocol === 'keto' ? 'Carb (cap)' : 'Carb'}
            value={target.carb_g}
            styles={styles}
          />
        </View>

        {target.net_carb_g_cap !== null ? (
          <Text style={styles.footnote}>
            Keto ceiling: {target.net_carb_g_cap} g net carbs / {target.carb_g}{' '}
            g total carbs.
          </Text>
        ) : null}

        <Text style={styles.methodLine}>
          {describeMethod(target.bmr_method)} · BMR {target.bmr_kcal} kcal ·
          TDEE {target.tdee_kcal} kcal
        </Text>
        {target.low_confidence ? (
          <Text style={styles.footnote}>
            Add height, lean mass (DEXA preferred), and activity level to your
            profile for a validated Mifflin-St Jeor / Katch-McArdle target.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function MacroStat({
  label,
  value,
  styles,
}: {
  label: string;
  value: number;
  styles: ReturnType<typeof buildStyles>;
}) {
  return (
    <View style={styles.macroCell}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>
        {value}
        <Text style={styles.macroUnit}> g</Text>
      </Text>
    </View>
  );
}

function humanizeMissing(missing: string[]): string {
  const readable = missing.map((m) =>
    m === 'bodyweight_kg' ? 'bodyweight' : 'biological sex',
  );
  if (readable.length === 1) return readable[0];
  return readable.slice(0, -1).join(', ') + ' and ' + readable.at(-1);
}

function describeMethod(method: 'katch_mcardle' | 'mifflin_st_jeor' | 'fallback'): string {
  if (method === 'katch_mcardle') return 'Katch-McArdle';
  if (method === 'mifflin_st_jeor') return 'Mifflin-St Jeor';
  return 'Bodyweight estimate';
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    wrap: { gap: spacing[3] },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      justifyContent: 'space-between',
    },
    header: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
    },
    badge: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.sm,
      paddingHorizontal: spacing[2],
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeText: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      padding: spacing[4],
      gap: spacing[3],
      borderLeftWidth: 3,
      borderLeftColor: colors.secondary,
    },
    kcalRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing[2],
    },
    kcalValue: {
      fontSize: typography.sizes['3xl'],
      fontWeight: typography.weights.black,
      color: colors.text,
    },
    kcalUnit: {
      fontSize: typography.sizes.md,
      color: colors.textTertiary,
      fontWeight: typography.weights.semibold,
    },
    macroRow: {
      flexDirection: 'row',
      gap: spacing[3],
    },
    macroCell: {
      flex: 1,
      backgroundColor: colors.bg,
      borderRadius: radii.sm,
      padding: spacing[3],
      gap: spacing[1],
    },
    macroLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontWeight: typography.weights.semibold,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
    },
    macroValue: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    macroUnit: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      fontWeight: typography.weights.regular,
    },
    footnote: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    methodLine: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
    emptyCard: {
      flexDirection: 'row',
      gap: spacing[2],
      alignItems: 'center',
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      padding: spacing[4],
    },
    emptyText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
  });
}
