// @spec docs/features/lipedema-tracking/spec-data-layer.md
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { priorValue } from '../lib/trends';
import { mmToCmString, parseInProgressCmToMm } from '../lib/units';
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

function shiftIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const LIMBS: Limb[] = ['thigh_mid', 'calf_max', 'ankle', 'upper_arm', 'wrist'];

const LIMB_ROW_KEYS: Record<
  Limb,
  {
    l: keyof MeasurementDraft;
    r: keyof MeasurementDraft;
    pickL: (m: LipedemaMeasurement) => number | null;
    pickR: (m: LipedemaMeasurement) => number | null;
  }
> = {
  thigh_mid: {
    l: 'thighMidL',
    r: 'thighMidR',
    pickL: (m) => m.thighMidLMm,
    pickR: (m) => m.thighMidRMm,
  },
  calf_max: {
    l: 'calfMaxL',
    r: 'calfMaxR',
    pickL: (m) => m.calfMaxLMm,
    pickR: (m) => m.calfMaxRMm,
  },
  ankle: {
    l: 'ankleL',
    r: 'ankleR',
    pickL: (m) => m.ankleLMm,
    pickR: (m) => m.ankleRMm,
  },
  upper_arm: {
    l: 'upperArmL',
    r: 'upperArmR',
    pickL: (m) => m.upperArmLMm,
    pickR: (m) => m.upperArmRMm,
  },
  wrist: {
    l: 'wristL',
    r: 'wristR',
    pickL: (m) => m.wristLMm,
    pickR: (m) => m.wristRMm,
  },
};

type ToastKind = 'saved' | 'deleted';

export function TrackingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const measurementsQuery = useMeasurements();
  const saveMutation = useSaveMeasurement();
  const deleteMutation = useDeleteMeasurement();

  const today = todayIso();
  const [draft, setDraft] = useState<MeasurementDraft>(() => emptyDraft(today));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastKind | null>(null);

  // Preload guard: load the row for the current draft date exactly once
  // each time the date changes. Without this, every refetch (including
  // post-save invalidation) would clobber unsaved edits.
  //
  // Path matrix (rows = react-query data, ref = loadedForDate.current):
  //   save-then-invalidate ........ rows new ref, ref matches → skip ✓
  //   date-nav prev/next/today .... ref stale, dep changed     → load ✓
  //   tap history (other date) .... ref pre-set, then setDraft → skip ✓
  //   tap history (same date) ..... ref unchanged              → noop ✓
  //   delete current-day entry .... ref cleared in handler     → load empty ✓
  //   delete other-day entry ...... ref unchanged, rows new    → skip ✓
  //   pre-fill from last entry .... no dep change              → noop ✓
  const loadedForDate = useRef<string | null>(null);
  const rows = measurementsQuery.data;

  useEffect(() => {
    if (!rows) return;
    if (loadedForDate.current === draft.recordedDate) return;
    loadedForDate.current = draft.recordedDate;
    const existing = rows.find((m) => m.recordedDate === draft.recordedDate);
    setDraft(existing ? measurementToDraft(existing) : emptyDraft(draft.recordedDate));
  }, [rows, draft.recordedDate]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(id);
  }, [toast]);

  const updateField = useCallback(
    <K extends keyof MeasurementDraft>(key: K, value: MeasurementDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
      if (saveError) setSaveError(null);
    },
    [saveError],
  );

  const goToDate = useCallback((iso: string) => {
    setSaveError(null);
    setDraft((prev) => ({ ...prev, recordedDate: iso }));
  }, []);

  const useLastEntry = useCallback(() => {
    if (!rows) return;
    const prior = rows.find((m) => m.recordedDate !== draft.recordedDate);
    if (!prior) return;
    const filled = measurementToDraft(prior);
    setDraft({ ...filled, recordedDate: draft.recordedDate });
  }, [rows, draft.recordedDate]);

  async function handleSave() {
    setSaveError(null);
    if (draftIsEmpty(draft)) {
      setSaveError('Enter at least one field before saving.');
      return;
    }
    try {
      await saveMutation.mutateAsync(draftToUpsert(draft));
      setToast('saved');
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
              if (entry.recordedDate === draft.recordedDate) {
                loadedForDate.current = null; // re-preload (will be empty)
              }
              setToast('deleted');
            } catch (err) {
              captureException(err);
              Alert.alert(
                'Could not delete',
                'The entry is still there. Check your connection and try again.',
              );
            }
          },
        },
      ],
    );
  }

  function loadEntryIntoForm(entry: LipedemaMeasurement) {
    setSaveError(null);
    loadedForDate.current = entry.recordedDate; // we set draft directly; skip re-preload
    setDraft(measurementToDraft(entry));
  }

  if (measurementsQuery.isPending) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const allRows = rows ?? [];
  const isToday = draft.recordedDate === today;
  const draftIsBlank = draftIsEmpty(draft);
  const existingForDate = allRows.find((m) => m.recordedDate === draft.recordedDate);
  const lastEntryDate = allRows.find((m) => m.recordedDate !== draft.recordedDate)
    ?.recordedDate;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Date navigator */}
      <View style={styles.dateNav}>
        <TouchableOpacity
          onPress={() => goToDate(shiftIso(draft.recordedDate, -1))}
          style={styles.dateNavBtn}
          hitSlop={8}
          accessibilityLabel="Previous day"
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.dateNavCenter}>
          <Text style={styles.dateNavLabel}>
            {isToday ? 'Today' : formatDate(draft.recordedDate)}
          </Text>
          {!isToday && (
            <TouchableOpacity onPress={() => goToDate(today)} hitSlop={6}>
              <Text style={styles.dateNavToToday}>Jump to today</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => goToDate(shiftIso(draft.recordedDate, 1))}
          style={[
            styles.dateNavBtn,
            draft.recordedDate >= today && styles.dateNavBtnDisabled,
          ]}
          hitSlop={8}
          disabled={draft.recordedDate >= today}
          accessibilityLabel="Next day"
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={
              draft.recordedDate >= today ? colors.textTertiary : colors.text
            }
          />
        </TouchableOpacity>
      </View>

      {existingForDate && (
        <View style={styles.editingBanner}>
          <Ionicons
            name="create-outline"
            size={14}
            color={colors.primary}
          />
          <Text style={styles.editingBannerText}>
            Editing existing entry · saving will overwrite
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.hint}>
          Circumferences in cm (one decimal). Same landmark each time —
          relaxed muscle, morning if possible. Blank fields stay blank.
        </Text>

        {LIMBS.map((limb) => {
          const keys = LIMB_ROW_KEYS[limb];
          const priorL = priorValue(allRows, keys.pickL, draft.recordedDate);
          const priorR = priorValue(allRows, keys.pickR, draft.recordedDate);
          return (
            <View key={limb} style={styles.limbBlock}>
              <Text style={styles.limbLabel}>{LIMB_LABELS[limb]}</Text>
              <View style={styles.limbInputs}>
                <SideInput
                  side="L"
                  value={draft[keys.l] as string}
                  onChange={(v) => updateField(keys.l, v)}
                  prior={priorL}
                  styles={styles}
                  colors={colors}
                />
                <SideInput
                  side="R"
                  value={draft[keys.r] as string}
                  onChange={(v) => updateField(keys.r, v)}
                  prior={priorR}
                  styles={styles}
                  colors={colors}
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
              returnKeyType="done"
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
              returnKeyType="done"
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
          style={[
            styles.saveButton,
            (saveMutation.isPending || draftIsBlank) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saveMutation.isPending}
          activeOpacity={0.8}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.saveButtonText}>
              {existingForDate ? 'Update entry' : isToday ? 'Save today' : 'Save entry'}
            </Text>
          )}
        </TouchableOpacity>

        {draftIsBlank && lastEntryDate && (
          <TouchableOpacity
            onPress={useLastEntry}
            style={styles.secondaryButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name="copy-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.secondaryButtonText}>
              Pre-fill from {formatDate(lastEntryDate)}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.header}>History</Text>
      {allRows.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            name="body-outline"
            size={28}
            color={colors.textTertiary}
          />
          <Text style={styles.emptyText}>
            No entries yet. Log your first measurement above — even one limb
            is enough to start a trend.
          </Text>
        </View>
      ) : (
        allRows.map((m) => (
          <HistoryCard
            key={m.id}
            entry={m}
            isCurrent={m.recordedDate === draft.recordedDate}
            onTap={() => loadEntryIntoForm(m)}
            onDelete={() => handleDelete(m)}
            styles={styles}
            colors={colors}
          />
        ))
      )}

      {toast && (
        <View
          style={[
            styles.toast,
            toast === 'deleted' && styles.toastDanger,
          ]}
          pointerEvents="none"
        >
          <Ionicons
            name={toast === 'saved' ? 'checkmark-circle' : 'trash'}
            size={16}
            color={colors.textInverse}
          />
          <Text style={styles.toastText}>
            {toast === 'saved' ? 'Saved' : 'Deleted'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function SideInput({
  side,
  value,
  onChange,
  prior,
  styles,
  colors,
}: {
  side: 'L' | 'R';
  value: string;
  onChange: (v: string) => void;
  prior: { date: string; value: number } | null;
  styles: ReturnType<typeof buildStyles>;
  colors: ColorScheme;
}) {
  const currentMm = parseInProgressCmToMm(value);
  const delta = currentMm != null && prior ? currentMm - prior.value : null;

  return (
    <View style={styles.sideInputWrap}>
      <View style={styles.sideInputRow}>
        <Text style={styles.sideTag}>{side}</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={prior ? mmToCmString(prior.value) : '—'}
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
          returnKeyType="done"
        />
      </View>
      {delta != null && delta !== 0 ? (
        <Text
          style={[
            styles.deltaTag,
            delta > 0 ? styles.deltaTagUp : styles.deltaTagDown,
          ]}
        >
          {delta > 0 ? '▲' : '▼'} {(Math.abs(delta) / 10).toFixed(1)} cm
        </Text>
      ) : prior ? (
        <Text style={styles.deltaTagMuted}>
          prev {mmToCmString(prior.value)}
        </Text>
      ) : (
        <Text style={styles.deltaTagMuted}>no prior</Text>
      )}
    </View>
  );
}

function HistoryCard({
  entry,
  isCurrent,
  onTap,
  onDelete,
  styles,
  colors,
}: {
  entry: LipedemaMeasurement;
  isCurrent: boolean;
  onTap: () => void;
  onDelete: () => void;
  styles: ReturnType<typeof buildStyles>;
  colors: ColorScheme;
}) {
  const limbLines = LIMBS.map((limb) => {
    const keys = LIMB_ROW_KEYS[limb];
    const l = keys.pickL(entry);
    const r = keys.pickR(entry);
    if (l == null && r == null) return null;
    return `${LIMB_LABELS[limb]}  ${formatLR(l, r)}`;
  }).filter((s): s is string => s !== null);

  return (
    <TouchableOpacity
      style={[styles.historyCard, isCurrent && styles.historyCardActive]}
      onPress={onTap}
      activeOpacity={0.75}
    >
      <View style={styles.historyRow}>
        <View style={styles.historyHeading}>
          <Text style={styles.historyDate}>{formatDate(entry.recordedDate)}</Text>
          {isCurrent && (
            <View style={styles.historyActiveBadge}>
              <Text style={styles.historyActiveBadgeText}>EDITING</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onDelete} hitSlop={10}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {limbLines.length > 0 && (
        <View style={styles.historyLimbs}>
          {limbLines.map((line) => (
            <Text key={line} style={styles.historyLimbLine}>
              {line}
            </Text>
          ))}
        </View>
      )}

      {(entry.painScore != null || entry.swellingScore != null) && (
        <View style={styles.historyChips}>
          {entry.painScore != null && (
            <View style={styles.historyChip}>
              <Text style={styles.historyChipText}>
                Pain {entry.painScore}
              </Text>
            </View>
          )}
          {entry.swellingScore != null && (
            <View style={styles.historyChip}>
              <Text style={styles.historyChipText}>
                Swell {entry.swellingScore}
              </Text>
            </View>
          )}
        </View>
      )}

      {entry.notes ? (
        <Text style={styles.historyNotes} numberOfLines={2}>
          {entry.notes}
        </Text>
      ) : null}

      {limbLines.length === 0 &&
      entry.painScore == null &&
      entry.swellingScore == null &&
      !entry.notes ? (
        <Text style={styles.historyEmpty}>(empty entry)</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function formatLR(l: number | null, r: number | null): string {
  const lv = l == null ? '—' : `${mmToCmString(l)} cm`;
  const rv = r == null ? '—' : `${mmToCmString(r)} cm`;
  return `L ${lv}  ·  R ${rv}`;
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

    // Date navigator
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[2],
    },
    dateNavBtn: {
      padding: spacing[2],
      borderRadius: radii.sm,
    },
    dateNavBtnDisabled: { opacity: 0.4 },
    dateNavCenter: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    dateNavLabel: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.text,
      letterSpacing: typography.letterSpacing.wide,
    },
    dateNavToToday: {
      fontSize: typography.sizes.xs,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },

    editingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.sm,
    },
    editingBannerText: {
      fontSize: typography.sizes.xs,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
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
      lineHeight: 16,
    },

    // Per-limb block
    limbBlock: {
      gap: spacing[1],
    },
    limbLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    limbInputs: {
      flexDirection: 'row',
      gap: spacing[3],
    },
    sideInputWrap: {
      flex: 1,
      gap: 2,
    },
    sideInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    sideTag: {
      width: 16,
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontWeight: typography.weights.bold,
    },

    input: {
      flex: 1,
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

    deltaTag: {
      marginLeft: 22,
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
    },
    deltaTagUp: { color: colors.danger },
    deltaTagDown: { color: colors.primary },
    deltaTagMuted: {
      marginLeft: 22,
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
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

    secondaryButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing[2],
      paddingVertical: spacing[2],
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },

    errorText: {
      color: colors.danger,
      fontSize: typography.sizes.sm,
    },

    emptyCard: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      padding: spacing[5],
      alignItems: 'center',
      gap: spacing[2],
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      textAlign: 'center',
      lineHeight: 18,
    },

    historyCard: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      padding: spacing[3],
      gap: spacing[2],
      borderWidth: 1,
      borderColor: 'transparent',
    },
    historyCardActive: {
      borderColor: colors.primary,
    },
    historyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    historyHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    historyDate: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    historyActiveBadge: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: spacing[2],
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    historyActiveBadgeText: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: typography.weights.bold,
      letterSpacing: typography.letterSpacing.wider,
    },
    historyLimbs: {
      gap: 2,
    },
    historyLimbLine: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    historyChips: {
      flexDirection: 'row',
      gap: spacing[2],
      flexWrap: 'wrap',
    },
    historyChip: {
      paddingHorizontal: spacing[2],
      paddingVertical: 2,
      backgroundColor: colors.bgMuted,
      borderRadius: radii.sm,
    },
    historyChipText: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      fontWeight: typography.weights.semibold,
    },
    historyNotes: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontStyle: 'italic',
      lineHeight: 15,
    },
    historyEmpty: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },

    toast: {
      position: 'absolute',
      bottom: spacing[6],
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: colors.primary,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: radii.lg,
    },
    toastDanger: {
      backgroundColor: colors.danger,
    },
    toastText: {
      color: colors.textInverse,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
      letterSpacing: typography.letterSpacing.wide,
    },

    stateBox: {
      padding: spacing[6],
      alignItems: 'center',
    },
  });
}
