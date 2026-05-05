import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WearableSettings } from '@modules/wearable';

import { BackLink } from '../../components/navigation/BackLink';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import { spacing } from '../../theme';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

export default function WearableSettingsScreen() {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
      </View>
      <View style={styles.titleWrap}>
        <ScreenTitle marginBottom={spacing[1]}>Wearable</ScreenTitle>
      </View>
      <WearableSettings />
    </SafeAreaView>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[6],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
    },
    titleWrap: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
    },
  });
}
