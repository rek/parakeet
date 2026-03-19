import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../theme';

export function ScreenHeader({ children }: { children: ReactNode }) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          paddingHorizontal: spacing[5],
          paddingTop: spacing[2],
          paddingBottom: spacing[5],
        },
      }),
    []
  );

  return <View style={styles.header}>{children}</View>;
}
