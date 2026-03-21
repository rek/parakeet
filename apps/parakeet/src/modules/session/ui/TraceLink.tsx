import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import type { PrescriptionTrace } from '@parakeet/training-engine';

import { spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { PrescriptionSheet } from './PrescriptionSheet';

/**
 * Small "ⓘ Reasoning" link that opens the prescription trace sheet.
 *
 * Owns its own visibility state + PrescriptionSheet render,
 * so the parent doesn't need to manage trace sheet state.
 */
export function TraceLink({
  trace,
  focusExercise,
}: {
  trace: PrescriptionTrace;
  focusExercise?: string;
}) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
        hitSlop={12}
      >
        <Ionicons
          name="information-circle-outline"
          size={14}
          color={colors.textTertiary}
        />
      </TouchableOpacity>
      <PrescriptionSheet
        visible={visible}
        onClose={() => setVisible(false)}
        trace={trace}
        focusExercise={focusExercise}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
    marginLeft: 4,
  },
  text: {
    fontSize: typography.sizes.xs,
  },
});
