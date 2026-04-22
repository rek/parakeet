import { StyleSheet, Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { getExerciseSubtitle } from '@shared/utils/exercise-lookup';
import { formatExerciseName } from '@shared/utils/string';

import { useTheme } from '../../theme/ThemeContext';

interface ExerciseNameProps {
  name: string;
  /** Style applied to the outer Text (typography + layout). */
  nameStyle?: StyleProp<TextStyle>;
  /** Clamp lines — passed to the outer Text so long names truncate correctly. */
  numberOfLines?: number;
}

export function ExerciseName({
  name,
  nameStyle,
  numberOfLines,
}: ExerciseNameProps) {
  const { colors } = useTheme();
  const subtitle = getExerciseSubtitle(name);

  return (
    <Text style={nameStyle} numberOfLines={numberOfLines}>
      {formatExerciseName(name)}
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
          {'\n'}
          {subtitle}
        </Text>
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 11,
    fontWeight: 'normal',
    // Override any textTransform/letterSpacing inherited from a parent Text.
    textTransform: 'none',
    letterSpacing: 0,
  },
});
