import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useOtaUpdateStatus } from '../OtaUpdatesContext';

export function UpdateReadyBanner() {
  const { colors } = useTheme();
  const { status, applyUpdate, reloadOutcome, dismissReloadOutcome } =
    useOtaUpdateStatus();

  // Auto-dismiss successful applied banner after 4s. Rolled-back stays until tapped.
  useEffect(() => {
    if (reloadOutcome?.type !== 'applied') return;
    const t = setTimeout(dismissReloadOutcome, 4000);
    return () => clearTimeout(t);
  }, [reloadOutcome, dismissReloadOutcome]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          alignSelf: 'center',
          borderRadius: radii.full,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
        },
        success: {
          backgroundColor: colors.success,
        },
        danger: {
          backgroundColor: colors.danger,
        },
        label: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.textInverse,
        },
      }),
    [colors]
  );

  if (reloadOutcome?.type === 'applied') {
    return (
      <TouchableOpacity
        onPress={dismissReloadOutcome}
        activeOpacity={0.85}
        style={[styles.pill, styles.success]}
      >
        <Text style={styles.label}>
          Update applied · {reloadOutcome.updateId.slice(0, 8)}
        </Text>
      </TouchableOpacity>
    );
  }

  if (reloadOutcome?.type === 'rolled-back') {
    return (
      <TouchableOpacity
        onPress={dismissReloadOutcome}
        activeOpacity={0.85}
        style={[styles.pill, styles.danger]}
      >
        <Text style={styles.label}>Update failed — rolled back</Text>
      </TouchableOpacity>
    );
  }

  if (status !== 'ready' && status !== 'restarting') return null;

  return (
    <TouchableOpacity
      onPress={applyUpdate}
      activeOpacity={0.85}
      disabled={status === 'restarting'}
      style={[styles.pill, styles.success]}
    >
      <Text style={styles.label}>
        {status === 'restarting' ? 'Restarting…' : 'Update ready — tap to restart'}
      </Text>
    </TouchableOpacity>
  );
}
