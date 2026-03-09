import { useEffect, useMemo, useState } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { calculatePlates, PLATE_COLORS } from '@parakeet/training-engine'
import type { PlateKg } from '@parakeet/training-engine'
import { getDisabledPlates, setDisabledPlates } from '@modules/settings'
import { spacing, typography } from '../../theme'
import type { ColorScheme } from '../../theme'
import { useTheme } from '../../theme/ThemeContext'

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'bar_weight_kg'
const BAR_OPTIONS = [20, 15] as const
type BarKg = (typeof BAR_OPTIONS)[number]

const TOGGLEABLE_PLATES: PlateKg[] = [25, 20, 15, 10, 5, 2.5, 1.25]

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  onClose: () => void
  targetKg: number
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlayLight,
    },
    sheet: {
      backgroundColor: colors.bgSurface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 40,
      maxHeight: '65%',
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      flex: 1,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    closeBtn: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: typography.weights.bold,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    toggleLabel: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    toggleGroup: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    toggleBtn: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgMuted,
    },
    toggleBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    toggleBtnText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
    },
    toggleBtnTextActive: {
      color: colors.primary,
    },
    plateToggleSection: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    plateToggleLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing[2],
    },
    plateToggleRow: {
      flexDirection: 'row',
      gap: spacing[2],
      flexWrap: 'wrap',
    },
    plateDot: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plateDotLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textSecondary,
    },
    plateDotLabelEnabled: {
      color: colors.textInverse,
    },
    content: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing[2],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    summaryRowLast: {
      marginBottom: spacing[4],
    },
    summaryLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    sectionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.textTertiary,
      letterSpacing: 1,
      marginBottom: spacing[2],
    },
    plateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[2],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    plateKg: {
      flex: 1,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    plateCount: {
      fontSize: typography.sizes.base,
      color: colors.textSecondary,
    },
    remainderBox: {
      marginTop: spacing[4],
      padding: spacing[3],
      borderRadius: 8,
      backgroundColor: colors.warningMuted,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    remainderText: {
      fontSize: typography.sizes.sm,
      color: colors.warning,
    },
    center: {
      alignItems: 'center',
      paddingVertical: spacing[6],
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlateCalculatorSheet({ visible, onClose, targetKg }: Props) {
  const { colors } = useTheme()
  const [barKg, setBarKg] = useState<BarKg>(20)
  const [disabledPlates, setDisabledPlatesState] = useState<PlateKg[]>([])

  const styles = useMemo(() => buildStyles(colors), [colors])

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === '15') setBarKg(15)
    })
    getDisabledPlates().then(setDisabledPlatesState)
  }, [])

  const availablePlates = TOGGLEABLE_PLATES.filter((p) => !disabledPlates.includes(p))

  async function handlePlateToggle(plate: PlateKg) {
    const next = disabledPlates.includes(plate)
      ? disabledPlates.filter((p) => p !== plate)
      : [...disabledPlates, plate]
    setDisabledPlatesState(next)
    await setDisabledPlates(next)
  }

  function handleBarToggle(kg: BarKg) {
    setBarKg(kg)
    AsyncStorage.setItem(STORAGE_KEY, String(kg))
  }

  const isBarOnly = targetKg <= barKg
  const result = isBarOnly ? null : calculatePlates(targetKg, barKg, availablePlates)

  function renderContent() {
    if (isBarOnly) {
      return (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Bar only — no plates needed</Text>
        </View>
      )
    }

    return (
      <>
        {/* Summary row */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>{targetKg} kg</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowLast]}>
          <Text style={styles.summaryLabel}>Bar</Text>
          <Text style={styles.summaryValue}>{barKg} kg</Text>
        </View>

        {/* Plates per side */}
        <Text style={styles.sectionLabel}>PER SIDE</Text>
        {result!.platesPerSide.map((plate) => (
          <View key={plate.kg} style={styles.plateRow}>
            <Text style={styles.plateKg}>{plate.kg} kg</Text>
            <Text style={styles.plateCount}>× {plate.count}</Text>
          </View>
        ))}

        {/* Remainder warning */}
        {result!.remainder > 0 && (
          <View style={styles.remainderBox}>
            <Text style={styles.remainderText}>
              Nearest achievable: {targetKg - result!.remainder * 2} kg — {result!.remainder * 2} kg short
            </Text>
          </View>
        )}
      </>
    )
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Plate Calculator</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Bar toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Bar weight</Text>
            <View style={styles.toggleGroup}>
              {BAR_OPTIONS.map((kg) => (
                <TouchableOpacity
                  key={kg}
                  style={[styles.toggleBtn, barKg === kg && styles.toggleBtnActive]}
                  onPress={() => handleBarToggle(kg)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleBtnText, barKg === kg && styles.toggleBtnTextActive]}>
                    {kg} kg
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Plate availability toggles */}
          <View style={styles.plateToggleSection}>
            <Text style={styles.plateToggleLabel}>Available plates</Text>
            <View style={styles.plateToggleRow}>
              {TOGGLEABLE_PLATES.map((kg) => {
                const enabled = !disabledPlates.includes(kg)
                return (
                  <TouchableOpacity
                    key={kg}
                    style={[styles.plateDot, { borderColor: PLATE_COLORS[kg] }, enabled && { backgroundColor: PLATE_COLORS[kg] }]}
                    onPress={() => handlePlateToggle(kg)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.plateDotLabel, enabled && styles.plateDotLabelEnabled]}>
                      {kg}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View style={styles.content}>
            {renderContent()}
          </View>
        </View>
      </View>
    </Modal>
  )
}
