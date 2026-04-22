// @spec docs/features/session/spec-logging.md
import { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../../theme/ThemeContext';
import type { FormattedTrace } from '../utils/format-trace';
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
  trace: FormattedTrace;
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
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
});
