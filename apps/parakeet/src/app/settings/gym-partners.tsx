import { ScrollView, StyleSheet } from 'react-native';

import { PartnerManagementScreen } from '@modules/gym-partners';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../components/navigation/BackLink';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import { spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

export default function GymPartnersSettingsRoute() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <BackLink onPress={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle>Gym Partners</ScreenTitle>
        <PartnerManagementScreen />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[12],
  },
});
