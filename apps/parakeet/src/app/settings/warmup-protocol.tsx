import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@modules/auth';
import { profileQueries } from '@modules/profile';
import { getCurrentOneRmKg } from '@modules/program';
import {
  estimateWorkingWeight,
  generateWarmupSets,
  getAllWarmupConfigs,
  getPresetSteps,
  settingsQueries,
  updateWarmupConfig,
  WARMUP_PRESETS,
} from '@modules/settings';
import type { WarmupProtocol, WarmupStep } from '@modules/settings';
import type { Lift } from '@parakeet/shared-types';
import { TRAINING_LIFTS } from '@shared/constants/training';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../components/navigation/BackLink';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const LIFTS = TRAINING_LIFTS;

const LIFT_LABELS: Record<Lift, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
};

// ── Styles ────────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bgSurface },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.bgMuted,
    },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    content: { paddingBottom: 48 },

    liftSection: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.bgMuted,
      gap: 12,
    },
    liftSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    liftSectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    saveLiftButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    saveLiftButtonDisabled: { opacity: 0.4 },
    saveLiftButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textInverse,
    },

    presetGrid: { gap: 8 },
    presetCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      gap: 2,
    },
    presetCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    presetLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    presetLabelSelected: { color: colors.primary },
    presetDescription: { fontSize: 12, color: colors.textTertiary },

    // Custom editor
    customEditor: {
      backgroundColor: colors.bgSurface,
      borderRadius: 10,
      padding: 12,
      gap: 8,
    },
    customEditorTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    customStep: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    customStepField: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    customStepLabel: { fontSize: 12, color: colors.textSecondary, width: 28 },
    customStepInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 15,
      color: colors.text,
      width: 48,
      textAlign: 'center',
    },
    customStepSep: { fontSize: 16, color: colors.textSecondary },
    removeStep: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.dangerMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 'auto',
    },
    removeStepText: { fontSize: 18, color: colors.danger, lineHeight: 22 },
    addStep: {
      paddingVertical: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      borderStyle: 'dashed',
    },
    addStepText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },

    // Preview
    preview: {
      backgroundColor: colors.successMuted,
      borderRadius: 8,
      padding: 10,
      gap: 4,
    },
    previewTitle: { fontSize: 11, color: colors.success, fontWeight: '600' },
    previewSets: { fontSize: 13, color: colors.success, lineHeight: 18 },
  });
}

type Styles = ReturnType<typeof buildStyles>;

// ── Custom step editor ────────────────────────────────────────────────────────

interface CustomStepEditorProps {
  steps: WarmupStep[];
  onChange: (steps: WarmupStep[]) => void;
  styles: Styles;
}

function CustomStepEditor({ steps, onChange, styles }: CustomStepEditorProps) {
  function updateStep(i: number, field: keyof WarmupStep, raw: string) {
    const value = parseInt(raw, 10);
    if (isNaN(value)) return;
    const next = steps.map((s, idx) =>
      idx === i ? { ...s, [field]: field === 'pct' ? value / 100 : value } : s
    );
    onChange(next);
  }

  function addStep() {
    const lastPct = steps.length > 0 ? steps[steps.length - 1].pct : 0.5;
    onChange([...steps, { pct: Math.min(0.99, lastPct + 0.1), reps: 3 }]);
  }

  function removeStep(i: number) {
    onChange(steps.filter((_, idx) => idx !== i));
  }

  return (
    <View style={styles.customEditor}>
      <Text style={styles.customEditorTitle}>Custom Steps</Text>
      {steps.map((step, i) => (
        <View key={i} style={styles.customStep}>
          <View style={styles.customStepField}>
            <Text style={styles.customStepLabel}>%</Text>
            <TextInput
              style={styles.customStepInput}
              value={String(Math.round(step.pct * 100))}
              onChangeText={(v) => updateStep(i, 'pct', v)}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <Text style={styles.customStepSep}>×</Text>
          <View style={styles.customStepField}>
            <Text style={styles.customStepLabel}>reps</Text>
            <TextInput
              style={styles.customStepInput}
              value={String(step.reps)}
              onChangeText={(v) => updateStep(i, 'reps', v)}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <TouchableOpacity
            style={styles.removeStep}
            onPress={() => removeStep(i)}
            activeOpacity={0.7}
          >
            <Text style={styles.removeStepText}>−</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={styles.addStep}
        onPress={addStep}
        activeOpacity={0.7}
      >
        <Text style={styles.addStepText}>+ Add Step</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Warmup preview ────────────────────────────────────────────────────────────

interface WarmupPreviewProps {
  protocol: WarmupProtocol;
  oneRmKg: number;
  lift: Lift;
  styles: Styles;
}

function WarmupPreview({
  protocol,
  oneRmKg,
  lift,
  styles,
}: WarmupPreviewProps) {
  if (!oneRmKg) return null;
  const workingWeight = estimateWorkingWeight(oneRmKg);
  const sets = generateWarmupSets(workingWeight, protocol);

  return (
    <View style={styles.preview}>
      <Text style={styles.previewTitle}>
        Preview ({lift} {oneRmKg}kg 1RM, ~{workingWeight}kg working)
      </Text>
      <Text style={styles.previewSets}>
        {sets.map((s) => `${s.displayWeight}×${s.reps}`).join(' → ')}
      </Text>
    </View>
  );
}

// ── Lift section ──────────────────────────────────────────────────────────────

interface LiftSectionProps {
  lift: Lift;
  protocol: WarmupProtocol;
  oneRmKg: number;
  isSaving: boolean;
  onChange: (p: WarmupProtocol) => void;
  onSave: () => void;
  styles: Styles;
  textInverseColor: string;
}

function LiftSection({
  lift,
  protocol,
  oneRmKg,
  isSaving,
  onChange,
  onSave,
  styles,
  textInverseColor,
}: LiftSectionProps) {
  const selectedPreset = protocol.type === 'preset' ? protocol.name : null;

  return (
    <View style={styles.liftSection}>
      <View style={styles.liftSectionHeader}>
        <Text style={styles.liftSectionTitle}>{LIFT_LABELS[lift]}</Text>
        <TouchableOpacity
          style={[
            styles.saveLiftButton,
            isSaving && styles.saveLiftButtonDisabled,
          ]}
          onPress={onSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color={textInverseColor} size="small" />
          ) : (
            <Text style={styles.saveLiftButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Preset picker */}
      <View style={styles.presetGrid}>
        {WARMUP_PRESETS.map((p) => (
          <TouchableOpacity
            key={p.name}
            style={[
              styles.presetCard,
              selectedPreset === p.name && styles.presetCardSelected,
            ]}
            onPress={() => onChange({ type: 'preset', name: p.name })}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.presetLabel,
                selectedPreset === p.name && styles.presetLabelSelected,
              ]}
            >
              {p.label}
            </Text>
            <Text style={styles.presetDescription}>{p.description}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            styles.presetCard,
            protocol.type === 'custom' && styles.presetCardSelected,
          ]}
          onPress={() =>
            onChange({
              type: 'custom',
              steps:
                protocol.type === 'custom'
                  ? protocol.steps
                  : getPresetSteps('standard'),
            })
          }
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.presetLabel,
              protocol.type === 'custom' && styles.presetLabelSelected,
            ]}
          >
            Custom
          </Text>
          <Text style={styles.presetDescription}>Define your own steps</Text>
        </TouchableOpacity>
      </View>

      {/* Custom editor */}
      {protocol.type === 'custom' && (
        <CustomStepEditor
          steps={protocol.steps}
          onChange={(steps) => onChange({ type: 'custom', steps })}
          styles={styles}
        />
      )}

      {/* Preview */}
      <WarmupPreview
        protocol={protocol}
        oneRmKg={oneRmKg}
        lift={lift}
        styles={styles}
      />
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WarmupProtocolScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [protocols, setProtocols] = useState<Record<
    Lift,
    WarmupProtocol
  > | null>(null);
  const [saving, setSaving] = useState<Partial<Record<Lift, boolean>>>({});

  const { data: profile } = useQuery({
    ...profileQueries.current(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: warmupData, isLoading } = useQuery({
    ...settingsQueries.warmup.configs(user?.id),
    queryFn: () =>
      getAllWarmupConfigs(user!.id, profile?.biological_sex ?? undefined),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (warmupData && !protocols) {
      setProtocols(warmupData);
    }
  }, [protocols, warmupData]);

  const { data: maxes } = useQuery({
    queryKey: ['maxes', 'all', user?.id],
    queryFn: async () => {
      const [squat, bench, deadlift] = await Promise.all([
        getCurrentOneRmKg(user!.id, 'squat'),
        getCurrentOneRmKg(user!.id, 'bench'),
        getCurrentOneRmKg(user!.id, 'deadlift'),
      ]);
      return { squat: squat ?? 0, bench: bench ?? 0, deadlift: deadlift ?? 0 };
    },
    enabled: !!user?.id,
  });

  async function handleSaveLift(lift: Lift) {
    if (!protocols || !user) return;
    setSaving((prev) => ({ ...prev, [lift]: true }));
    try {
      await updateWarmupConfig(user.id, lift, protocols[lift]);
      queryClient.invalidateQueries({ queryKey: settingsQueries.warmup.all() });
    } finally {
      setSaving((prev) => ({ ...prev, [lift]: false }));
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
        <ScreenTitle>Warmup Protocol</ScreenTitle>
      </View>

      {isLoading || !protocols ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {LIFTS.map((lift) => (
            <LiftSection
              key={lift}
              lift={lift}
              protocol={protocols[lift]}
              oneRmKg={maxes?.[lift] ?? 0}
              isSaving={!!saving[lift]}
              onChange={(p) =>
                setProtocols((prev) => (prev ? { ...prev, [lift]: p } : prev))
              }
              onSave={() => handleSaveLift(lift)}
              styles={styles}
              textInverseColor={colors.textInverse}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
