// @spec docs/features/rehab-mode/spec-ui.md
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { RehabCapRow } from '@modules/rehab-mode';
import type { Lift } from '@parakeet/shared-types';
import { LIFT_LABELS } from '@shared/constants';
import { formatDate } from '@shared/utils/date';
import { router } from 'expo-router';

import { palette, radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

// ── Styles ────────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    scrollContent: {
      paddingHorizontal: spacing[4],
      gap: spacing[2],
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1.5],
      borderWidth: 1,
      borderColor: palette.slate400,
      borderRadius: 999,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      backgroundColor: colors.bgMuted,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: palette.slate400,
    },
    chipText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      letterSpacing: typography.letterSpacing.wide,
      color: colors.textSecondary,
    },
    // Modal
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlayLight,
    },
    sheet: {
      backgroundColor: colors.bgSurface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 40,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: spacing[2],
      marginBottom: spacing[1],
    },
    modalHeader: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    modalTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    closeBtn: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: typography.weights.bold,
    },
    modalBody: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[4],
      gap: spacing[2],
    },
    detailRow: { flexDirection: 'row', gap: spacing[3] },
    detailLabel: {
      width: 80,
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
    },
    detailValue: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text,
    },
    description: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingTop: spacing[2],
    },
    editBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing[3],
      alignItems: 'center',
    },
    editBtnText: {
      color: colors.textInverse,
      fontWeight: typography.weights.bold,
      fontSize: typography.sizes.sm,
    },
    endBtn: {
      flex: 1,
      backgroundColor: colors.dangerMuted,
      borderRadius: radii.md,
      paddingVertical: spacing[3],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.danger,
    },
    endBtnText: {
      color: colors.danger,
      fontWeight: typography.weights.bold,
      fontSize: typography.sizes.sm,
    },
  });
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

function RehabCapSheet({
  cap,
  onClose,
  onEnd,
}: {
  cap: RehabCapRow | null;
  onClose: () => void;
  onEnd: (id: string) => Promise<void> | void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  function confirmEnd() {
    if (!cap) return;
    Alert.alert(
      `End Rehab Mode for ${LIFT_LABELS[cap.lift as Lift]}?`,
      'Future sessions will resume normal weights from your real 1RM.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Rehab Mode',
          style: 'destructive',
          onPress: async () => {
            await onEnd(cap.id);
            onClose();
          },
        },
      ]
    );
  }

  function goToSettings() {
    onClose();
    router.push('/settings/rehab-mode');
  }

  return (
    <Modal visible={!!cap} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              🩹 {cap ? LIFT_LABELS[cap.lift as Lift] : ''} — Rehab Mode
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {cap && (
            <View style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Cap</Text>
                <Text style={styles.detailValue}>{cap.cap_kg} kg</Text>
              </View>
              {cap.note ? (
                <Text style={styles.description}>{cap.note}</Text>
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
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={goToSettings}
              activeOpacity={0.8}
            >
              <Text style={styles.editBtnText}>Edit Cap</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.endBtn}
              onPress={confirmEnd}
              activeOpacity={0.8}
            >
              <Text style={styles.endBtnText}>End</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Chips row ─────────────────────────────────────────────────────────────────

interface Props {
  caps: RehabCapRow[];
  onEnd: (id: string) => Promise<void> | void;
}

export function RehabCapChipsRow({ caps, onEnd }: Props) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<RehabCapRow | null>(null);
  const styles = useMemo(() => buildStyles(colors), [colors]);

  if (!caps.length) return null;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {caps.map((cap) => (
          <TouchableOpacity
            key={cap.id}
            style={styles.chip}
            onPress={() => setSelected(cap)}
            activeOpacity={0.75}
          >
            <View style={styles.dot} />
            <Text style={styles.chipText}>
              🩹 {LIFT_LABELS[cap.lift as Lift]} — Rehab
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <RehabCapSheet
        cap={selected}
        onClose={() => setSelected(null)}
        onEnd={onEnd}
      />
    </View>
  );
}
