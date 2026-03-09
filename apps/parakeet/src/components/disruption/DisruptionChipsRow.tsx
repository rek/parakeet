import { useMemo, useState } from 'react'
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'

import { resolveDisruption, updateDisruptionEndDate } from '@modules/disruptions'
import { captureException } from '@platform/utils/captureException'
import { formatDate, localDateIso } from '@shared/utils/date'
import { palette, radii, spacing, typography } from '../../theme'
import { useTheme } from '../../theme/ThemeContext'
import type { ColorScheme } from '../../theme'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActiveDisruption {
  id: string
  disruption_type: string
  severity: string
  affected_lifts: string[] | null
  description: string | null
  affected_date_end: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityColor(severity: string, colors: ColorScheme): string {
  if (severity === 'major') return colors.danger
  if (severity === 'moderate') return palette.orange500
  return colors.warning
}

function chipBg(severity: string, colors: ColorScheme): string {
  if (severity === 'major') return colors.dangerMuted
  return colors.warningMuted
}

function chipLabel(disruption_type: string): string {
  const word = disruption_type.split('_')[0]
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function typeLabel(disruption_type: string): string {
  return disruption_type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

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
      borderRadius: 999,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    chipText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      letterSpacing: typography.letterSpacing.wide,
    },
    // Modal
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
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
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalHeaderText: {
      flex: 1,
      gap: spacing[1.5],
    },
    modalTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    severityPill: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: spacing[2],
      paddingVertical: 2,
      backgroundColor: colors.bgMuted,
    },
    severityPillText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      textTransform: 'capitalize',
    },
    closeBtn: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: typography.weights.bold,
    },
    modalBody: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[4],
      gap: spacing[3],
    },
    description: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    detailRow: {
      flexDirection: 'row',
      gap: spacing[3],
    },
    detailLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      width: 60,
    },
    detailValue: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      flex: 1,
    },
    capitalize: {
      textTransform: 'capitalize',
    },
    detailValueMuted: {
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    editHint: {
      fontSize: typography.sizes.xs,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
      alignSelf: 'center',
    },
    saveEndDateBtn: {
      marginTop: spacing[2],
      backgroundColor: colors.primary,
      borderRadius: radii.sm,
      paddingVertical: spacing[2.5],
      alignItems: 'center',
    },
    saveEndDateBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
    btnDisabled: {
      opacity: 0.5,
    },
    resolveBtn: {
      backgroundColor: colors.primary,
      marginHorizontal: spacing[4],
      borderRadius: radii.md,
      paddingVertical: spacing[3.5],
      alignItems: 'center',
    },
    resolveBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
      color: colors.textInverse,
      letterSpacing: typography.letterSpacing.wide,
    },
  })
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function DisruptionDetailModal({
  disruption,
  userId,
  onClose,
  onResolved,
}: {
  disruption: ActiveDisruption | null
  userId: string
  onClose: () => void
  onResolved: () => void
}) {
  const { colors } = useTheme()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pendingEndDate, setPendingEndDate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const styles = useMemo(() => buildStyles(colors), [colors])

  const displayEndDate = pendingEndDate ?? disruption?.affected_date_end ?? null
  const hasUnsavedDate = pendingEndDate !== null && pendingEndDate !== disruption?.affected_date_end

  async function handleSaveEndDate() {
    if (!disruption || !pendingEndDate) return
    setSaving(true)
    try {
      await updateDisruptionEndDate(disruption.id, userId, pendingEndDate)
      onResolved()
      setPendingEndDate(null)
      setShowDatePicker(false)
    } catch (err) {
      captureException(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleResolve() {
    if (!disruption) return
    try {
      await resolveDisruption(disruption.id, userId)
      onResolved()
      onClose()
    } catch (err) {
      captureException(err)
    }
  }

  function confirmResolve() {
    Alert.alert('Mark as Resolved?', 'This will clear the disruption and regenerate affected sessions.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resolve', onPress: handleResolve },
    ])
  }

  function handleClose() {
    setPendingEndDate(null)
    setShowDatePicker(false)
    onClose()
  }

  const sevColor = disruption ? severityColor(disruption.severity, colors) : colors.warning

  return (
    <Modal
      visible={!!disruption}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>
                {disruption ? typeLabel(disruption.disruption_type) : ''}
              </Text>
              <View style={[styles.severityPill, { borderColor: sevColor }]}>
                <Text style={[styles.severityPillText, { color: sevColor }]}>
                  {disruption?.severity}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={12} activeOpacity={0.7}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            {disruption?.description ? (
              <Text style={styles.description}>{disruption.description}</Text>
            ) : null}

            {disruption?.affected_lifts && disruption.affected_lifts.length > 0 ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Affects</Text>
                <Text style={[styles.detailValue, styles.capitalize]}>
                  {disruption.affected_lifts.join(', ')}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => setShowDatePicker((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.detailLabel}>Until</Text>
              <Text style={[styles.detailValue, !displayEndDate && styles.detailValueMuted]}>
                {displayEndDate ? formatDate(displayEndDate) : 'Ongoing'}
              </Text>
              <Text style={styles.editHint}>Edit</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                mode="date"
                value={displayEndDate ? new Date(displayEndDate + 'T00:00:00') : new Date()}
                minimumDate={disruption?.affected_date_end
                  ? new Date(disruption.affected_date_end + 'T00:00:00')
                  : new Date()}
                onChange={(_e: DateTimePickerEvent, d?: Date) => {
                  if (Platform.OS === 'android') setShowDatePicker(false)
                  if (d) setPendingEndDate(localDateIso(d))
                }}
              />
            )}

            {hasUnsavedDate && (
              <TouchableOpacity
                style={[styles.saveEndDateBtn, saving && styles.btnDisabled]}
                onPress={handleSaveEndDate}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveEndDateBtnText}>
                  {saving ? 'Saving…' : 'Save End Date'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.resolveBtn} onPress={confirmResolve} activeOpacity={0.8}>
            <Text style={styles.resolveBtnText}>Mark Resolved</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── Chips row ─────────────────────────────────────────────────────────────────

interface Props {
  disruptions: ActiveDisruption[]
  userId: string
  onResolved: () => void
}

export function DisruptionChipsRow({ disruptions, userId, onResolved }: Props) {
  const { colors } = useTheme()
  const [selected, setSelected] = useState<ActiveDisruption | null>(null)

  const styles = useMemo(() => buildStyles(colors), [colors])

  if (!disruptions.length) return null

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {disruptions.map((d) => {
          const sevColor = severityColor(d.severity, colors)
          return (
            <TouchableOpacity
              key={d.id}
              style={[styles.chip, { borderColor: sevColor, backgroundColor: chipBg(d.severity, colors) }]}
              onPress={() => setSelected(d)}
              activeOpacity={0.75}
            >
              <View style={[styles.dot, { backgroundColor: sevColor }]} />
              <Text style={[styles.chipText, { color: sevColor }]}>
                ⚡ {chipLabel(d.disruption_type)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <DisruptionDetailModal
        disruption={selected}
        userId={userId}
        onClose={() => setSelected(null)}
        onResolved={() => {
          setSelected(null)
          onResolved()
        }}
      />
    </View>
  )
}
