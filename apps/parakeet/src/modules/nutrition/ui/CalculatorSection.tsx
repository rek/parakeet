import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useProfile } from '@modules/profile';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import {
  computeMacroTargets,
  type ActivityLevel,
  type BiologicalSex,
  type DietProtocolSlug,
  type Goal,
} from '../lib/macro-targets';

/**
 * Manual what-if calculator. Inputs default to the lifter's profile
 * when available; the user can override any field — including a
 * pinned kcal target — without persisting the change to the profile.
 * Pure inspection; no save button.
 */
export function CalculatorSection({
  defaultProtocol,
}: {
  defaultProtocol: DietProtocolSlug;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { data: profile } = useProfile();

  const [protocol, setProtocol] = useState<DietProtocolSlug>(defaultProtocol);
  const [bodyweight, setBodyweight] = useState(() =>
    profile?.bodyweight_kg != null ? profile.bodyweight_kg.toString() : '',
  );
  const [sex, setSex] = useState<BiologicalSex>(
    profile?.biological_sex ?? 'female',
  );
  const [age, setAge] = useState(() => {
    if (!profile?.date_of_birth) return '';
    const d = new Date(profile.date_of_birth);
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    return a.toString();
  });
  const [height, setHeight] = useState(() =>
    profile?.height_cm != null ? profile.height_cm.toString() : '',
  );
  const [leanMass, setLeanMass] = useState(() =>
    profile?.lean_mass_kg != null ? profile.lean_mass_kg.toString() : '',
  );
  // Powerlifter default: 'active'. The research-grade Harris-Benedict
  // activity multipliers undercount heavy-compound energy cost, so
  // parakeet's baseline assumes 5-6 sessions/week with compound lifts.
  // Users can drop to moderate if deload / sedentary job / low volume.
  const [activity, setActivity] = useState<ActivityLevel>(
    profile?.activity_level ?? 'active',
  );
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? 'maintain');
  const [trainingDay, setTrainingDay] = useState(false);
  const [kcalOverride, setKcalOverride] = useState('');

  const parsed = useMemo(() => {
    const bw = Number.parseFloat(bodyweight);
    if (!Number.isFinite(bw) || bw <= 0) return null;
    const ageN = Number.parseFloat(age);
    const heightN = Number.parseFloat(height);
    const leanN = Number.parseFloat(leanMass);
    const kcalN = Number.parseFloat(kcalOverride);
    return computeMacroTargets({
      bodyweight_kg: bw,
      biological_sex: sex,
      age_years: Number.isFinite(ageN) ? ageN : null,
      height_cm: Number.isFinite(heightN) && heightN > 0 ? heightN : null,
      lean_mass_kg: Number.isFinite(leanN) && leanN > 0 ? leanN : null,
      activity_level: activity,
      goal,
      protocol,
      training_day: trainingDay,
      kcal_override: Number.isFinite(kcalN) && kcalN > 0 ? kcalN : null,
    });
  }, [
    bodyweight,
    sex,
    age,
    height,
    leanMass,
    activity,
    goal,
    protocol,
    trainingDay,
    kcalOverride,
  ]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.header}>Protocol</Text>
      <View style={styles.pickerRow}>
        {(['keto', 'rad'] as DietProtocolSlug[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.pill, protocol === p && styles.pillActive]}
            onPress={() => setProtocol(p)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.pillText,
                protocol === p && styles.pillTextActive,
              ]}
            >
              {p === 'keto' ? 'Keto' : 'RAD'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.header}>Inputs</Text>
      <View style={styles.card}>
        <LabeledInput
          label="Bodyweight (kg)"
          value={bodyweight}
          onChangeText={setBodyweight}
          placeholder="e.g. 70"
          styles={styles}
          colors={colors}
        />
        <View style={styles.pickerRow}>
          {(['female', 'male'] as BiologicalSex[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.pill, sex === s && styles.pillActive]}
              onPress={() => setSex(s)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.pillText, sex === s && styles.pillTextActive]}
              >
                {s === 'female' ? 'Female' : 'Male'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row}>
          <View style={styles.cell}>
            <LabeledInput
              label="Age"
              value={age}
              onChangeText={setAge}
              placeholder="years"
              styles={styles}
              colors={colors}
            />
          </View>
          <View style={styles.cell}>
            <LabeledInput
              label="Height (cm)"
              value={height}
              onChangeText={setHeight}
              placeholder="e.g. 170"
              styles={styles}
              colors={colors}
            />
          </View>
        </View>
        <LabeledInput
          label="Lean mass (kg) — optional"
          value={leanMass}
          onChangeText={setLeanMass}
          placeholder="DEXA-preferred; leave blank if unsure"
          styles={styles}
          colors={colors}
        />

        <Text style={styles.smallLabel}>Activity</Text>
        <Text style={styles.hint}>
          Powerlifter anchor: "Active" = 5–6 heavy-compound sessions/week.
          "Moderate" if deload / low volume. The general-population
          multipliers undercount strength-training NEAT.
        </Text>
        <View style={styles.pickerRow}>
          {(
            [
              'sedentary',
              'light',
              'moderate',
              'active',
              'very_active',
            ] as ActivityLevel[]
          ).map((a) => (
            <TouchableOpacity
              key={a}
              style={[styles.pillSm, activity === a && styles.pillActive]}
              onPress={() => setActivity(a)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.pillTextSm,
                  activity === a && styles.pillTextActive,
                ]}
              >
                {a === 'very_active' ? 'Very' : cap(a)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.smallLabel}>Goal</Text>
        <View style={styles.pickerRow}>
          {(['cut', 'maintain', 'bulk'] as Goal[]).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.pill, goal === g && styles.pillActive]}
              onPress={() => setGoal(g)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.pillText, goal === g && styles.pillTextActive]}
              >
                {cap(g)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.toggle, trainingDay && styles.toggleOn]}
          onPress={() => setTrainingDay((v) => !v)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.toggleText,
              trainingDay && styles.toggleTextOn,
            ]}
          >
            Training day (+10% protein)  {trainingDay ? '●' : '○'}
          </Text>
        </TouchableOpacity>

        <LabeledInput
          label="Pin kcal target (optional)"
          value={kcalOverride}
          onChangeText={setKcalOverride}
          placeholder="e.g. 2000 — overrides BMR × activity × goal"
          styles={styles}
          colors={colors}
        />
      </View>

      <Text style={styles.header}>Output</Text>
      {parsed ? (
        <View style={styles.outCard}>
          <View style={styles.kcalRow}>
            <Text style={styles.kcalValue}>{parsed.kcal}</Text>
            <Text style={styles.kcalUnit}>kcal</Text>
            {parsed.kcal_overridden ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>pinned</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.macroRow}>
            <MacroCell label="Protein" value={parsed.protein_g} styles={styles} />
            <MacroCell label="Fat" value={parsed.fat_g} styles={styles} />
            <MacroCell
              label={protocol === 'keto' ? 'Carb (cap)' : 'Carb'}
              value={parsed.carb_g}
              styles={styles}
            />
          </View>
          <View style={styles.splitRow}>
            <Text style={styles.splitLine}>
              {pct(parsed.protein_g * 4, parsed.kcal)}% P ·{' '}
              {pct(parsed.fat_g * 9, parsed.kcal)}% F ·{' '}
              {pct(parsed.carb_g * 4, parsed.kcal)}% C
            </Text>
          </View>
          {parsed.net_carb_g_cap !== null ? (
            <Text style={styles.footnote}>
              Keto ceiling: {parsed.net_carb_g_cap} g net / {parsed.carb_g} g
              total.
            </Text>
          ) : null}
          <Text style={styles.methodLine}>
            {methodLabel(parsed.bmr_method)} · BMR {parsed.bmr_kcal} · TDEE{' '}
            {parsed.tdee_kcal}
            {parsed.kcal_overridden
              ? ` · derived was ${Math.round(
                  parsed.tdee_kcal *
                    (goal === 'cut' ? 0.85 : goal === 'bulk' ? 1.1 : 1),
                )}`
              : ''}
          </Text>
          {parsed.low_confidence ? (
            <Text style={styles.footnote}>
              Low confidence — fill height + age for a validated BMR.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Enter bodyweight to see targets.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  styles,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  styles: ReturnType<typeof buildStyles>;
  colors: ColorScheme;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

function MacroCell({
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

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function methodLabel(m: 'katch_mcardle' | 'mifflin_st_jeor' | 'fallback'): string {
  if (m === 'katch_mcardle') return 'Katch-McArdle';
  if (m === 'mifflin_st_jeor') return 'Mifflin-St Jeor';
  return 'Bodyweight est.';
}
function pct(macroKcal: number, totalKcal: number): number {
  if (totalKcal <= 0) return 0;
  return Math.round((macroKcal / totalKcal) * 100);
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    content: { gap: spacing[3], paddingBottom: spacing[6] },
    header: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
    },
    smallLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
      marginBottom: spacing[1],
    },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      padding: spacing[4],
      gap: spacing[3],
    },
    fieldBlock: { gap: spacing[1] },
    row: { flexDirection: 'row', gap: spacing[3] },
    cell: { flex: 1 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      backgroundColor: colors.bg,
      color: colors.text,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      fontSize: typography.sizes.base,
    },
    pickerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    pill: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },
    pillSm: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },
    pillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    pillText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    pillTextSm: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    pillTextActive: { color: colors.primary },
    toggle: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[3],
      alignItems: 'center',
    },
    toggleOn: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    toggleText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
    },
    toggleTextOn: { color: colors.primary },
    outCard: {
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
    badge: {
      marginLeft: 'auto',
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing[2],
      paddingVertical: 2,
    },
    badgeText: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    macroRow: { flexDirection: 'row', gap: spacing[3] },
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
    splitRow: {},
    splitLine: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
    methodLine: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
    footnote: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    hint: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontStyle: 'italic',
      marginBottom: spacing[1],
    },
    emptyBox: {
      padding: spacing[4],
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
  });
}
