import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { useFeatureEnabled } from '@modules/feature-flags';

import { spacing } from '../../../theme';
import { useSetVideo } from '../hooks/useSetVideo';

/**
 * Small per-set camera icon for the session screen's SetRow.
 * Self-gated behind the videoAnalysis feature flag — renders null when disabled.
 * Only renders when the set is completed.
 * Shows a filled camera (📹) when a video exists for this set, hollow (📷) otherwise.
 */
export function SetVideoIcon({
  sessionId,
  lift,
  setNumber,
  isCompleted,
}: {
  sessionId: string;
  lift: string;
  setNumber: number;
  isCompleted: boolean;
}) {
  const enabled = useFeatureEnabled('videoAnalysis');
  const router = useRouter();
  const { hasVideo } = useSetVideo({ sessionId, lift, setNumber });

  if (!enabled || !isCompleted) return null;

  function handlePress() {
    router.push({
      pathname: '/session/video-analysis' as never,
      params: { sessionId, lift, setNumber: String(setNumber) },
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
      <Text style={styles.icon}>{hasVideo ? '📹' : '📷'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { marginLeft: spacing[1] },
  icon: { fontSize: 16 },
});
