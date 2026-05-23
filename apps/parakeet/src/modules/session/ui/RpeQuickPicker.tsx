// @spec docs/features/session/spec-set-persistence.md
import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

interface RpeQuickPickerProps {
  onSelect: (rpe: number, painLimited: boolean) => void;
  onSkip: () => void;
  contextLabel?: string;
  /** When true, render the Rehab Mode pain-limited pill above the RPE row
   *  so the lifter can tag this set's RPE as pain-limited vs muscular (GH#220).
   *  Defaults off; rendered only when an active rehab cap covers the current
   *  lift. */
  showPainLimitedToggle?: boolean;
  /** When showPainLimitedToggle is true, this is the initial state of the
   *  toggle. Defaults to whether the previous set was pain-limited (passed by
   *  the caller); saves taps in the common case where the whole session is
   *  pain-limited. */
  defaultPainLimited?: boolean;
}

export function RpeQuickPicker({
  onSelect,
  onSkip,
  contextLabel,
  showPainLimitedToggle = false,
  defaultPainLimited = false,
}: RpeQuickPickerProps) {
  const { colors } = useTheme();
  const [painLimited, setPainLimited] = useState(defaultPainLimited);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.bgElevated,
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3.5],
          paddingBottom: spacing[3],
          alignItems: 'center',
          width: '100%',
          maxWidth: 560,
          gap: spacing[2.5],
        },
        label: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.medium,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: typography.letterSpacing.wider,
        },
        buttons: {
          flexDirection: 'row',
          gap: spacing[1.5],
        },
        rpeButton: {
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
          borderRadius: radii.md,
          backgroundColor: colors.bgMuted,
          borderWidth: 1,
          borderColor: colors.border,
          minWidth: 44,
          alignItems: 'center',
        },
        rpeText: {
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
          color: colors.text,
        },
        context: {
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.medium,
          color: colors.textSecondary,
          letterSpacing: typography.letterSpacing.tight,
        },
        skip: {
          fontSize: typography.sizes.sm,
          color: colors.textTertiary,
        },
        painPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[1.5],
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1.5],
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgMuted,
        },
        painPillActive: {
          borderColor: colors.warning,
          backgroundColor: colors.warningMuted,
        },
        painPillText: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
          color: colors.textSecondary,
        },
        painPillTextActive: {
          color: colors.warning,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      {contextLabel && <Text style={styles.context}>{contextLabel}</Text>}
      <Text style={styles.label}>How'd that feel?</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={styles.buttons}
      >
        {RPE_OPTIONS.map((rpe) => (
          <TouchableOpacity
            key={rpe}
            style={styles.rpeButton}
            onPress={() => onSelect(rpe, painLimited)}
            activeOpacity={0.7}
          >
            <Text style={styles.rpeText}>{rpe}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {showPainLimitedToggle && (
        <TouchableOpacity
          style={[styles.painPill, painLimited && styles.painPillActive]}
          onPress={() => setPainLimited((v) => !v)}
          activeOpacity={0.75}
          accessibilityRole="switch"
          accessibilityState={{ checked: painLimited }}
          accessibilityLabel="Tag this set as pain-limited"
        >
          <Text
            style={[
              styles.painPillText,
              painLimited && styles.painPillTextActive,
            ]}
          >
            🩹 {painLimited ? 'Pain-limited' : 'Tap if pain-limited'}
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={onSkip}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
      >
        <Text style={styles.skip}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}
