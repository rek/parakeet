import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFeatureEnabled } from '@modules/feature-flags';
import { NutritionScreen } from '@modules/nutrition';

import { HeaderMenuButton } from '../../components/ui/HeaderMenuButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import { spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

export default function NutritionRoute() {
  const { colors } = useTheme();
  const nutritionEnabled = useFeatureEnabled('nutrition');
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
    [colors],
  );

  if (!nutritionEnabled) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader>
        <View style={styles.headerLeft}>
          <HeaderMenuButton />
          <ScreenTitle>Nutrition</ScreenTitle>
        </View>
      </ScreenHeader>
      <NutritionScreen />
    </SafeAreaView>
  );
}
