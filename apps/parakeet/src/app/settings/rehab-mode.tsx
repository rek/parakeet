// @spec docs/features/rehab-mode/spec-ui.md
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@modules/auth';
import { getCurrentOneRmKg } from '@modules/program';
import {
  ActiveRehabCapExistsError,
  type RehabCapRow,
  useActiveRehabCaps,
  useRehabModeMutations,
} from '@modules/rehab-mode';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import type { Lift } from '@parakeet/shared-types';
import { roundToNearest } from '@parakeet/training-engine';
import { captureException } from '@platform/utils/captureException';
import { LIFT_LABELS } from '@shared/constants';
import { formatDate, localDateIso } from '@shared/utils/date';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../components/navigation/BackLink';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import type { ColorScheme } from '../../theme';
import { radii, spacing, typography } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

const LIFTS: Lift[] = ['squat', 'bench', 'deadlift'];

// ── Styles ────────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingHorizontal: spacing[6],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
    },
    titleWrap: { paddingHorizontal: spacing[6], paddingBottom: spacing[6] },
    subtitle: { fontSize: typography.sizes.sm, color: colors.textSecondary },
    listContent: { paddingHorizontal: spacing[6], paddingBottom: spacing[12] },
    card: {
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing[4],
      marginBottom: spacing[3],
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing[2],
    },
    liftLabel: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    activePill: {
      backgroundColor: colors.warningMuted,
      borderColor: colors.warning,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: spacing[2],
      paddingVertical: 2,
    },
    activePillText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.warning,
    },
    detailRow: {
      flexDirection: 'row',
      gap: spacing[3],
      marginBottom: spacing[1.5],
    },
    detailLabel: {
      width: 80,
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
    },
    detailValue: { flex: 1, fontSize: typography.sizes.sm, color: colors.text },
    actionRow: {
      flexDirection: 'row',
      gap: spacing[2],
      marginTop: spacing[3],
    },
    primaryBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing[3],
      alignItems: 'center',
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontWeight: typography.weights.bold,
      fontSize: typography.sizes.sm,
    },
    dangerBtn: {
      flex: 1,
      backgroundColor: colors.dangerMuted,
      borderRadius: radii.md,
      paddingVertical: spacing[3],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.danger,
    },
    dangerBtnText: {
      color: colors.danger,
      fontWeight: typography.weights.bold,
      fontSize: typography.sizes.sm,
    },
    btnDisabled: { opacity: 0.5 },
    enableBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing[3],
      alignItems: 'center',
      marginTop: spacing[2],
    },
    enableBtnText: {
      color: colors.textInverse,
      fontWeight: typography.weights.bold,
      fontSize: typography.sizes.sm,
    },
    emptyNote: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing[1],
    },
    // Form modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlayLight,
    },
    modalSheet: {
      backgroundColor: colors.bgSurface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: spacing[5],
      gap: spacing[3],
    },
    modalTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginBottom: spacing[1],
    },
    fieldLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
    },
    input: {
      backgroundColor: colors.bgMuted,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      fontSize: typography.sizes.base,
      color: colors.text,
    },
    inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
    dateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.bgMuted,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
    },
    dateRowValue: { fontSize: typography.sizes.base, color: colors.text },
    dateRowAction: {
      fontSize: typography.sizes.sm,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    helperText: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
    modalActions: {
      flexDirection: 'row',
      gap: spacing[2],
      marginTop: spacing[2],
    },
    cancelBtn: {
      flex: 1,
      backgroundColor: colors.bgMuted,
      borderRadius: radii.md,
      paddingVertical: spacing[3],
      alignItems: 'center',
    },
    cancelBtnText: {
      color: colors.text,
      fontWeight: typography.weights.semibold,
      fontSize: typography.sizes.sm,
    },
    centeredLoading: { padding: spacing[8], alignItems: 'center' },
  });
}

// ── Form modal ────────────────────────────────────────────────────────────────

interface FormState {
  capKg: string;
  note: string;
  plannedEndDate: string | null;
}

interface FormProps {
  visible: boolean;
  lift: Lift;
  initial: FormState;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (next: FormState) => Promise<void>;
}

function RehabCapForm({
  visible,
  lift,
  initial,
  saving,
  onCancel,
  onSubmit,
}: FormProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [capKg, setCapKg] = useState(initial.capKg);
  const [note, setNote] = useState(initial.note);
  const [plannedEndDate, setPlannedEndDate] = useState<string | null>(
    initial.plannedEndDate
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Reset local state when modal becomes visible with new initial values
  useMemo(() => {
    if (visible) {
      setCapKg(initial.capKg);
      setNote(initial.note);
      setPlannedEndDate(initial.plannedEndDate);
    }
  }, [visible, initial.capKg, initial.note, initial.plannedEndDate]);

  const parsedCap = Number(capKg);
  const canSubmit = Number.isFinite(parsedCap) && parsedCap > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onCancel}
        />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>
            Rehab Mode — {LIFT_LABELS[lift]}
          </Text>

          <Text style={styles.fieldLabel}>Cap weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={capKg}
            onChangeText={setCapKg}
            keyboardType="decimal-pad"
            placeholder="e.g. 60"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.helperText}>
            Prescribed weight will never exceed this (rounded up to your plate increment).
          </Text>

          <Text style={styles.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. right knee, sub-quad pain on descent"
            placeholderTextColor={colors.textTertiary}
            multiline
          />

          <Text style={styles.fieldLabel}>Planned end date (optional)</Text>
          <TouchableOpacity
            style={styles.dateRow}
            activeOpacity={0.7}
            onPress={() => setShowDatePicker((v) => !v)}
          >
            <Text style={styles.dateRowValue}>
              {plannedEndDate ? formatDate(plannedEndDate) : 'No end date set'}
            </Text>
            <Text style={styles.dateRowAction}>
              {plannedEndDate ? 'Change' : 'Set'}
            </Text>
          </TouchableOpacity>
          {plannedEndDate && (
            <TouchableOpacity onPress={() => setPlannedEndDate(null)}>
              <Text style={[styles.helperText, { color: colors.primary }]}>
                Clear end date
              </Text>
            </TouchableOpacity>
          )}
          {showDatePicker && (
            <DateTimePicker
              mode="date"
              value={
                plannedEndDate
                  ? new Date(plannedEndDate + 'T00:00:00')
                  : new Date()
              }
              minimumDate={new Date()}
              onChange={(_e: DateTimePickerEvent, d?: Date) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (d) setPlannedEndDate(localDateIso(d));
              }}
            />
          )}

          <Text style={styles.helperText}>
            The cap stays active until you turn it off — the end date is just a reminder.
          </Text>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.7}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
              onPress={() =>
                onSubmit({ capKg, note, plannedEndDate })
              }
              activeOpacity={0.8}
              disabled={!canSubmit}
            >
              <Text style={styles.primaryBtnText}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RehabModeSettings() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { data: activeCaps, isLoading } = useActiveRehabCaps();
  const { enable, update, end } = useRehabModeMutations();

  const [editingLift, setEditingLift] = useState<Lift | null>(null);
  const [formInitial, setFormInitial] = useState<FormState>({
    capKg: '',
    note: '',
    plannedEndDate: null,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const capsByLift = useMemo(() => {
    const map = new Map<Lift, RehabCapRow>();
    for (const cap of activeCaps ?? []) {
      map.set(cap.lift as Lift, cap);
    }
    return map;
  }, [activeCaps]);

  const saving = enable.isPending || update.isPending || end.isPending;

  async function openForEnable(lift: Lift) {
    if (!user?.id) return;
    // Default cap = 50% of current 1RM, rounded to 2.5kg.
    let defaultCapKg = 0;
    try {
      defaultCapKg = (await getCurrentOneRmKg(user.id, lift)) ?? 0;
    } catch (err) {
      captureException(err);
    }
    const defaultCap = defaultCapKg > 0 ? roundToNearest(defaultCapKg * 0.5) : 0;
    setEditingId(null);
    setFormInitial({
      capKg: defaultCap > 0 ? String(defaultCap) : '',
      note: '',
      plannedEndDate: null,
    });
    setEditingLift(lift);
  }

  function openForEdit(cap: RehabCapRow) {
    setEditingId(cap.id);
    setFormInitial({
      capKg: String(cap.cap_kg),
      note: cap.note ?? '',
      plannedEndDate: cap.planned_end_date,
    });
    setEditingLift(cap.lift as Lift);
  }

  function confirmEnd(cap: RehabCapRow) {
    Alert.alert(
      `End Rehab Mode for ${LIFT_LABELS[cap.lift as Lift]}?`,
      'Future sessions will resume normal weights from your real 1RM.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Rehab Mode',
          style: 'destructive',
          onPress: () => {
            end.mutate(cap.id, {
              onError: (err) => {
                captureException(err);
                Alert.alert(
                  'Error',
                  'Failed to end Rehab Mode. Please try again.'
                );
              },
            });
          },
        },
      ]
    );
  }

  async function handleSubmit(next: FormState) {
    const capKgValue = Number(next.capKg);
    if (!Number.isFinite(capKgValue) || capKgValue <= 0) return;
    const note = next.note.trim();
    const payload = {
      cap_kg: capKgValue,
      ...(note.length > 0 ? { note } : {}),
      ...(next.plannedEndDate ? { planned_end_date: next.plannedEndDate } : {}),
    };
    try {
      if (editingId) {
        await update.mutateAsync({
          id: editingId,
          patch: {
            cap_kg: payload.cap_kg,
            note: note.length > 0 ? note : null,
            planned_end_date: next.plannedEndDate ?? null,
          },
        });
      } else if (editingLift) {
        await enable.mutateAsync({ lift: editingLift, ...payload });
      }
      setEditingLift(null);
      setEditingId(null);
    } catch (err) {
      if (err instanceof ActiveRehabCapExistsError) {
        Alert.alert('Already Active', err.message);
      } else {
        captureException(err);
        Alert.alert('Error', 'Failed to save Rehab Mode. Please try again.');
      }
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
      </View>
      <View style={styles.titleWrap}>
        <ScreenTitle>Rehab Mode</ScreenTitle>
        <Text style={styles.subtitle}>
          Cap one or more lifts at a fixed weight during a rehab or injury block.
          The engine respects the cap as a hard ceiling and pauses auto-progression
          for that lift — your real 1RM is preserved.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centeredLoading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {LIFTS.map((lift) => {
            const cap = capsByLift.get(lift);
            return (
              <View key={lift} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.liftLabel}>{LIFT_LABELS[lift]}</Text>
                  {cap ? (
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>🩹 Active</Text>
                    </View>
                  ) : null}
                </View>

                {cap ? (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Cap</Text>
                      <Text style={styles.detailValue}>{cap.cap_kg} kg</Text>
                    </View>
                    {cap.note ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Note</Text>
                        <Text style={styles.detailValue}>{cap.note}</Text>
                      </View>
                    ) : null}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Started</Text>
                      <Text style={styles.detailValue}>
                        {formatDate(cap.started_at)}
                      </Text>
                    </View>
                    {cap.planned_end_date ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Planned end</Text>
                        <Text style={styles.detailValue}>
                          {formatDate(cap.planned_end_date)}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.primaryBtn, saving && styles.btnDisabled]}
                        onPress={() => openForEdit(cap)}
                        activeOpacity={0.8}
                        disabled={saving}
                      >
                        <Text style={styles.primaryBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dangerBtn, saving && styles.btnDisabled]}
                        onPress={() => confirmEnd(cap)}
                        activeOpacity={0.8}
                        disabled={saving}
                      >
                        <Text style={styles.dangerBtnText}>End</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyNote}>
                      Rehab Mode is off for this lift.
                    </Text>
                    <TouchableOpacity
                      style={[styles.enableBtn, saving && styles.btnDisabled]}
                      onPress={() => openForEnable(lift)}
                      activeOpacity={0.8}
                      disabled={saving}
                    >
                      <Text style={styles.enableBtnText}>Enable Rehab Mode</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <RehabCapForm
        visible={editingLift !== null}
        lift={editingLift ?? 'squat'}
        initial={formInitial}
        saving={saving}
        onCancel={() => {
          setEditingLift(null);
          setEditingId(null);
        }}
        onSubmit={handleSubmit}
      />
    </SafeAreaView>
  );
}
