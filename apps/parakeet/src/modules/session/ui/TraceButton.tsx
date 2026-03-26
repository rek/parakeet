import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useFeatureEnabled } from '@modules/feature-flags';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import type { FormattedTrace } from '../utils/format-trace';
import { PrescriptionSheet } from './PrescriptionSheet';

export function TraceButton({
  prescriptionTrace,
  colors,
}: {
  prescriptionTrace: FormattedTrace;
  colors: ColorScheme;
}) {
  const [visible, setVisible] = useState(false);
  const traceEnabled = useFeatureEnabled('prescriptionTrace');

  if (!traceEnabled) return null;

  const styles = buildStyles(colors);

  return (
    <>
      <TouchableOpacity
        style={styles.traceButton}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.traceButtonText}>Workout Reasoning</Text>
      </TouchableOpacity>
      <PrescriptionSheet
        visible={visible}
        onClose={() => setVisible(false)}
        trace={prescriptionTrace}
      />
    </>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    traceButton: {
      marginTop: spacing[4],
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[4],
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
    },
    traceButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },
  });
}
