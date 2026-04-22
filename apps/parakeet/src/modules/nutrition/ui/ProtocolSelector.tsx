// @spec docs/features/nutrition/spec-ui.md
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { DietProtocol } from '../model/types';

export function ProtocolSelector({
  protocols,
  selectedSlug,
  onSelect,
}: {
  protocols: DietProtocol[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {protocols.map((p) => {
        const active = p.slug === selectedSlug;
        return (
          <TouchableOpacity
            key={p.slug}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onSelect(p.slug)}
            activeOpacity={0.75}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {p.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
    pill: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: radii.full ?? 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgSurface,
    },
    pillActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    label: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    labelActive: { color: colors.primary },
  });
}
