import { StyleSheet } from 'react-native';

import { WorkoutTemplatesList } from '@modules/workout-templates';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../../components/navigation/BackLink';
import { ScreenTitle } from '../../../components/ui/ScreenTitle';
import { spacing } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

export default function WorkoutTemplatesListRoute() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <BackLink onPress={() => router.back()} />
      <SafeAreaView style={styles.container}>
        <ScreenTitle>Workout Templates</ScreenTitle>
        <WorkoutTemplatesList />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
  },
});
