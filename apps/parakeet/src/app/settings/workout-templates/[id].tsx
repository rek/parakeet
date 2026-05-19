import { StyleSheet } from 'react-native';

import { WorkoutTemplateEditor } from '@modules/workout-templates';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../../components/navigation/BackLink';
import { ScreenTitle } from '../../../components/ui/ScreenTitle';
import { spacing } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

export default function WorkoutTemplateEditorRoute() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <BackLink onPress={() => router.back()} />
      <SafeAreaView style={styles.container}>
        <ScreenTitle>
          {id === 'new' ? 'New Template' : 'Edit Template'}
        </ScreenTitle>
        <WorkoutTemplateEditor templateId={id ?? 'new'} />
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
