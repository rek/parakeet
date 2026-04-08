import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useOtaUpdateStatus } from '../OtaUpdatesContext';

export function UpdateReadyBanner() {
  const { colors } = useTheme();
  const { status, applyUpdate } = useOtaUpdateStatus();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          alignSelf: 'center',
          backgroundColor: colors.success,
          borderRadius: radii.full,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
        },
        label: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.textInverse,
        },
      }),
    [colors]
  );

  if (status !== 'ready' && status !== 'restarting') return null;

  return (
    <TouchableOpacity
      onPress={applyUpdate}
      activeOpacity={0.85}
      disabled={status === 'restarting'}
      style={styles.pill}
    >
      <Text style={styles.label}>
        {status === 'restarting' ? 'Restarting…' : 'Update ready — tap to restart'}
      </Text>
    </TouchableOpacity>
  );
}
