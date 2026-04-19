import { StyleSheet, TouchableOpacity } from 'react-native';

import { useFeatureEnabled } from '@modules/feature-flags';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { spacing } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useSetVideo } from '../hooks/useSetVideo';

/**
 * Small per-set video icon for the session/history SetRow.
 * Self-gated behind the videoAnalysis feature flag — renders null when disabled.
 * Only renders when the set is completed.
 * Filled videocam when a video exists for this set, outline otherwise.
 */
export function SetVideoIcon({
  sessionId,
  lift,
  setNumber,
  isCompleted,
  weightGrams,
  reps,
  rpe,
}: {
  sessionId: string;
  lift: string;
  setNumber: number;
  isCompleted: boolean;
  weightGrams?: number;
  reps?: number;
  rpe?: number;
}) {
  const enabled = useFeatureEnabled('videoAnalysis');
  const router = useRouter();
  const { colors } = useTheme();
  const { hasVideo } = useSetVideo({ sessionId, lift, setNumber });

  if (!enabled || !isCompleted) return null;

  function handlePress() {
    router.push({
      pathname: '/session/video-analysis' as never,
      params: {
        sessionId,
        lift,
        setNumber: String(setNumber),
        ...(weightGrams != null ? { weightGrams: String(weightGrams) } : {}),
        ...(reps != null ? { reps: String(reps) } : {}),
        ...(rpe != null ? { rpe: String(rpe) } : {}),
      },
    });
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={styles.container}
      activeOpacity={0.7}
      accessible
      accessibilityLabel={
        hasVideo
          ? `View video for set ${setNumber}`
          : `Add video for set ${setNumber}`
      }
      accessibilityRole="button"
    >
      <Ionicons
        name={hasVideo ? 'videocam' : 'videocam-outline'}
        size={20}
        color={hasVideo ? colors.primary : colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { marginLeft: spacing[1] },
});
