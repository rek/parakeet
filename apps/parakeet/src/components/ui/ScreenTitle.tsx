import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { typography } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

export function ScreenTitle({
  children,
  marginBottom,
}: {
  children: string;
  marginBottom?: number;
}) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: {
          fontSize: typography.sizes['2xl'],
          fontWeight: typography.weights.black,
          color: colors.text,
          letterSpacing: typography.letterSpacing.tight,
          ...(marginBottom != null ? { marginBottom } : {}),
        },
      }),
    [colors, marginBottom]
  );

  return <Text style={styles.title}>{children}</Text>;
}
