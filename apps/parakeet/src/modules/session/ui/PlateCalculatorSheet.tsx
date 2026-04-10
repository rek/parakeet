import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { calculatePlates, PLATE_SIZES_KG } from '@shared/constants/plates';
import type { PlateKg } from '@shared/constants/plates';

import { PlateToggleRow } from '../../../components/ui/PlateToggleRow';
import { Sheet } from '../../../components/ui/Sheet';
import { spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const BAR_OPTIONS = [20, 15] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  targetKg: number;
  barWeightKg: number;
  disabledPlates: PlateKg[];
  onBarWeightChange: (kg: number) => void;
  onDisabledPlatesChange: (plates: PlateKg[]) => void;
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
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
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlateCalculatorSheet({
  visible,
  onClose,
  targetKg,
  barWeightKg,
  disabledPlates,
  onBarWeightChange,
  onDisabledPlatesChange,
}: Props) {
  const { colors } = useTheme();

  const styles = useMemo(() => buildStyles(colors), [colors]);

  const availablePlates = [...PLATE_SIZES_KG].filter(
    (p) => !disabledPlates.includes(p)
  );

  function handlePlateToggle(plate: PlateKg) {
    const next = disabledPlates.includes(plate)
      ? disabledPlates.filter((p) => p !== plate)
      : [...disabledPlates, plate];
    onDisabledPlatesChange(next);
  }

  function handleBarToggle(kg: number) {
    onBarWeightChange(kg);
  }

  const isBarOnly = targetKg <= barWeightKg;
  const result = isBarOnly
    ? null
    : calculatePlates(targetKg, barWeightKg, availablePlates);

  function renderContent() {
    if (isBarOnly) {
      return (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Bar only — no plates needed</Text>
        </View>
      );
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
          <Text style={styles.summaryValue}>{barWeightKg} kg</Text>
        </View>

        {/* Plates per side */}
        <Text style={styles.sectionLabel}>PER SIDE</Text>
        {result!.platesPerSide.map((plate) => (
          <View key={plate.kg} style={styles.plateRow}>
            <Text style={styles.plateKg}>{plate.kg} kg</Text>
            <Text style={styles.plateCount}>
              {'\u00D7'} {plate.count}
            </Text>
          </View>
        ))}

        {/* Remainder warning */}
        {result!.remainder > 0 && (
          <View style={styles.remainderBox}>
            <Text style={styles.remainderText}>
              Nearest achievable: {targetKg - result!.remainder * 2} kg —{' '}
              {result!.remainder * 2} kg short
            </Text>
          </View>
        )}
      </>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Plate Calculator"
      position="bottom"
    >
      {/* Bar toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Bar weight</Text>
        <View style={styles.toggleGroup}>
          {BAR_OPTIONS.map((kg) => (
            <TouchableOpacity
              key={kg}
              style={[
                styles.toggleBtn,
                barWeightKg === kg && styles.toggleBtnActive,
              ]}
              onPress={() => handleBarToggle(kg)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  barWeightKg === kg && styles.toggleBtnTextActive,
                ]}
              >
                {kg} kg
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Plate availability toggles */}
      <View style={styles.plateToggleSection}>
        <Text style={styles.plateToggleLabel}>Available plates</Text>
        <PlateToggleRow
          disabledPlates={disabledPlates}
          onToggle={handlePlateToggle}
          colors={colors}
        />
      </View>

      <View style={styles.content}>{renderContent()}</View>
    </Sheet>
  );
}
