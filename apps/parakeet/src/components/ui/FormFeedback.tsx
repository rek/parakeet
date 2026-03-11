import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { spacing, typography } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  success?: boolean | string;
  error?: string | null;
};

export function FormFeedback({ success, error }: Props) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        error: {
          marginTop: spacing[4],
          color: colors.danger,
          fontSize: typography.sizes.sm,
        },
        success: {
          marginTop: spacing[4],
          color: colors.success,
          fontSize: typography.sizes.sm,
        },
      }),
    [colors]
  );

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }
  if (success) {
    return (
      <Text style={styles.success}>
        {typeof success === 'string' ? success : 'Saved.'}
      </Text>
    );
  }
  return null;
}
