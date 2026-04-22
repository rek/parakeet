import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { getExerciseSubtitle } from '@shared/utils/exercise-lookup';
import { formatExerciseName } from '@shared/utils/string';

import { useTheme } from '../../theme/ThemeContext';

interface ExerciseNameProps {
  name: string;
  /** Style applied to the primary name text. */
  nameStyle?: StyleProp<TextStyle>;
}

export function ExerciseName({ name, nameStyle }: ExerciseNameProps) {
  const { colors } = useTheme();
  const subtitle = getExerciseSubtitle(name);

  return (
    <View>
      <Text style={nameStyle}>{formatExerciseName(name)}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
});
