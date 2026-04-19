import { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import { LeftDrawer } from './LeftDrawer';

export function HeaderMenuButton({ color }: { color?: string } = {}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          padding: spacing[1],
          marginLeft: -spacing[1],
          marginTop: 2,
        },
      }),
    []
  );

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityLabel="Open menu"
        accessibilityRole="button"
        hitSlop={8}
      >
        <Ionicons name="menu" size={28} color={color ?? colors.primary} />
      </TouchableOpacity>
      <LeftDrawer visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
