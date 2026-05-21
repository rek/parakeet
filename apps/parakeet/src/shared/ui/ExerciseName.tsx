import { StyleSheet, Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import {
  getDisplayNameForSlug,
  getExerciseSubtitle,
} from '@shared/utils/exercise-lookup';
import { formatExerciseName } from '@shared/utils/string';

import { useTheme } from '../../theme/ThemeContext';

interface ExerciseNameProps {
  name: string;
  /** Stable catalog slug. When provided, the display name is resolved
   *  through the catalog so renames take effect without DB sweeps. Falls
   *  back to `name` for customs and unknown slugs. */
  slug?: string | null;
  /** Style applied to the outer Text (typography + layout). */
  nameStyle?: StyleProp<TextStyle>;
  /** Clamp lines — passed to the outer Text so long names truncate correctly. */
  numberOfLines?: number;
}

export function ExerciseName({
  name,
  slug,
  nameStyle,
  numberOfLines,
}: ExerciseNameProps) {
  const { colors } = useTheme();
  const display = slug
    ? getDisplayNameForSlug(slug, name)
    : formatExerciseName(name);
  const subtitle = getExerciseSubtitle(slug ?? name);

  return (
    <Text style={nameStyle} numberOfLines={numberOfLines}>
      {display}
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
