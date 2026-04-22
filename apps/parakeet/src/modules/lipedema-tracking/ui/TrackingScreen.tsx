// @spec docs/features/lipedema-tracking/spec-data-layer.md
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { captureException } from '@platform/utils/captureException';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import {
  draftIsEmpty,
  draftToUpsert,
  emptyDraft,
  measurementToDraft,
} from '../application/draft';
import {
  useDeleteMeasurement,
  useMeasurements,
  useSaveMeasurement,
} from '../hooks/useMeasurements';
import { LIMB_LABELS } from '../model/types';
import type {
  Limb,
  LipedemaMeasurement,
  MeasurementDraft,
} from '../model/types';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const LIMBS: Limb[] = ['thigh_mid', 'calf_max', 'ankle', 'upper_arm', 'wrist'];

const LIMB_DRAFT_KEYS: Record<Limb, { l: keyof MeasurementDraft; r: keyof MeasurementDraft }> = {
  thigh_mid: { l: 'thighMidL', r: 'thighMidR' },
  calf_max: { l: 'calfMaxL', r: 'calfMaxR' },
  ankle: { l: 'ankleL', r: 'ankleR' },
  upper_arm: { l: 'upperArmL', r: 'upperArmR' },
  wrist: { l: 'wristL', r: 'wristR' },
};

export function TrackingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const measurementsQuery = useMeasurements();
  const saveMutation = useSaveMeasurement();
  const deleteMutation = useDeleteMeasurement();

  const [draft, setDraft] = useState<MeasurementDraft>(() =>
    emptyDraft(todayIso()),
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  // Preload today's entry if it already exists; else leave empty.
  useEffect(() => {
    const rows = measurementsQuery.data;
    if (!rows) return;
    const today = todayIso();
    const existing = rows.find((m) => m.recordedDate === today);
    if (existing) setDraft(measurementToDraft(existing));
  }, [measurementsQuery.data]);

  function updateField<K extends keyof MeasurementDraft>(
    key: K,
    value: MeasurementDraft[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaveError(null);
    if (draftIsEmpty(draft)) {
      setSaveError('Enter at least one field before saving.');
      return;
    }
    try {
      await saveMutation.mutateAsync(draftToUpsert(draft));
    } catch (err) {
      captureException(err);
      setSaveError('Could not save. Check connection and try again.');
    }
  }

  function handleDelete(entry: LipedemaMeasurement) {
    Alert.alert(
      'Delete entry',
      `Remove measurement from ${formatDate(entry.recordedDate)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(entry.id);
            } catch (err) {
              captureException(err);
            }
          },
        },
      ],
    );
  }

  if (measurementsQuery.isLoading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const rows = measurementsQuery.data ?? [];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.header}>Log measurement</Text>

      <View style={styles.card}>
        <Text style={styles.hint}>
          Circumferences in cm (one decimal). Leave blank if not measured today.
          DEXA-preferred for lean mass; tape for limb trends.
        </Text>

        {LIMBS.map((limb) => {
          const keys = LIMB_DRAFT_KEYS[limb];
          return (
            <View key={limb} style={styles.limbRow}>
              <Text style={styles.limbLabel}>{LIMB_LABELS[limb]}</Text>
              <View style={styles.limbInputs}>
                <TextInput
                  style={styles.input}
                  value={draft[keys.l] as string}
                  onChangeText={(v) => updateField(keys.l, v)}
                  placeholder="L"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={styles.input}
                  value={draft[keys.r] as string}
                  onChangeText={(v) => updateField(keys.r, v)}
                  placeholder="R"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          );
        })}

        <View style={styles.scalarRow}>
          <View style={styles.scalarCell}>
            <Text style={styles.scalarLabel}>Pain (0–10)</Text>
            <TextInput
              style={styles.input}
              value={draft.pain}
              onChangeText={(v) => updateField('pain', v)}
              placeholder="e.g. 3.5"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.scalarCell}>
            <Text style={styles.scalarLabel}>Swelling (0–10)</Text>
            <TextInput
              style={styles.input}
              value={draft.swelling}
              onChangeText={(v) => updateField('swelling', v)}
              placeholder="e.g. 2"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <Text style={styles.scalarLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={draft.notes}
          onChangeText={(v) => updateField('notes', v)}
          placeholder="Today felt… / compression worn… / MLD session?"
          placeholderTextColor={colors.textTertiary}
          multiline
        />

        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

        <TouchableOpacity
          style={[styles.saveButton, saveMutation.isPending && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saveMutation.isPending}
          activeOpacity={0.8}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.saveButtonText}>
              Save {draft.recordedDate === todayIso() ? "today's" : 'entry'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.header}>History</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No entries yet. Log your first above.</Text>
      ) : (
        rows.map((m) => (
          <View key={m.id} style={styles.historyCard}>
            <View style={styles.historyRow}>
              <Text style={styles.historyDate}>{formatDate(m.recordedDate)}</Text>
              <TouchableOpacity onPress={() => handleDelete(m)}>
                <Text style={styles.historyDelete}>Remove</Text>
              </TouchableOpacity>
            </View>
            <HistorySummary m={m} styles={styles} />
          </View>
        ))
      )}
    </ScrollView>
  );
}

function HistorySummary({
  m,
  styles,
}: {
  m: LipedemaMeasurement;
  styles: ReturnType<typeof buildStyles>;
}) {
  const parts: string[] = [];
  if (m.thighMidLMm != null || m.thighMidRMm != null) {
    parts.push(
      `Thigh ${fmtLR(m.thighMidLMm, m.thighMidRMm)} cm`,
    );
  }
  if (m.calfMaxLMm != null || m.calfMaxRMm != null) {
    parts.push(`Calf ${fmtLR(m.calfMaxLMm, m.calfMaxRMm)} cm`);
  }
  if (m.ankleLMm != null || m.ankleRMm != null) {
    parts.push(`Ankle ${fmtLR(m.ankleLMm, m.ankleRMm)} cm`);
  }
  if (m.pain_0_10 != null) parts.push(`pain ${m.pain_0_10}`);
  if (m.swelling_0_10 != null) parts.push(`swelling ${m.swelling_0_10}`);
  if (parts.length === 0 && m.notes) parts.push('(notes only)');
  return <Text style={styles.historySummary}>{parts.join(' · ')}</Text>;
}

function fmtLR(l: number | null, r: number | null): string {
  const lv = l == null ? '—' : (l / 10).toFixed(1);
  const rv = r == null ? '—' : (r / 10).toFixed(1);
  return `${lv} / ${rv}`;
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.bg },
    content: {
      padding: spacing[4],
      gap: spacing[4],
      paddingBottom: spacing[10],
    },
    header: {
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
      gap: spacing[3],
    },
    hint: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    limbRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    limbLabel: {
      flex: 1,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    limbInputs: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      backgroundColor: colors.bg,
      color: colors.text,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      fontSize: typography.sizes.base,
      minWidth: 60,
      textAlign: 'center',
    },
    notesInput: {
      minHeight: 60,
      textAlign: 'left',
      textAlignVertical: 'top',
    },
    scalarRow: {
      flexDirection: 'row',
      gap: spacing[3],
    },
    scalarCell: {
      flex: 1,
      gap: spacing[1],
    },
    scalarLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontWeight: typography.weights.semibold,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
    },
    saveButton: {
      marginTop: spacing[2],
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing[3],
      alignItems: 'center',
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: {
      color: colors.textInverse,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      letterSpacing: typography.letterSpacing.wide,
    },
    errorText: {
      color: colors.danger,
      fontSize: typography.sizes.sm,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      fontStyle: 'italic',
    },
    historyCard: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      padding: spacing[3],
      gap: spacing[1],
    },
    historyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    historyDate: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    historyDelete: {
      fontSize: typography.sizes.xs,
      color: colors.danger,
      fontWeight: typography.weights.medium,
    },
    historySummary: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
    },
    stateBox: {
      padding: spacing[6],
      alignItems: 'center',
    },
  });
}
