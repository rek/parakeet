import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFeatureEnabled } from '@modules/feature-flags';
import { FlockScreen } from '@modules/flock';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeaderMenuButton } from '../../components/ui/HeaderMenuButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import { spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

export default function FlockRoute() {
  const { colors } = useTheme();
  const flockEnabled = useFeatureEnabled('flock');
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.bg },
        headerLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
        },
      }),
    [colors]
  );

  if (!flockEnabled) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader>
        <View style={styles.headerLeft}>
          <HeaderMenuButton />
          <ScreenTitle>Flock</ScreenTitle>
        </View>
      </ScreenHeader>
      <FlockScreen />
    </SafeAreaView>
  );
}
