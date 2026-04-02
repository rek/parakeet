import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useFeatureEnabled } from '@modules/feature-flags';
import { useRouter } from 'expo-router';

import { spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

/**
 * Compact camera icon button for session/history screens.
 * Self-gated behind the videoAnalysis feature flag — renders nothing when disabled.
 * Screens just drop this in without knowing about video analysis internals.
 */
export function VideoEntryButton({
  sessionId,
  lift,
  variant = 'icon',
}: {
  sessionId: string;
  lift: string | null;
  variant?: 'icon' | 'link';
}) {
  const enabled = useFeatureEnabled('videoAnalysis');
  const router = useRouter();
  const { colors } = useTheme();

  if (!enabled || !lift) return null;

  function handlePress() {
    router.push({
      pathname: '/session/video-analysis' as never,
      params: { sessionId, lift },
    });
  }

  if (variant === 'link') {
    return (
      <TouchableOpacity
        style={styles.link}
        onPress={handlePress}
        activeOpacity={0.7}
        accessible
        accessibilityLabel="View or add form video"
        accessibilityRole="button"
      >
        <Text style={[styles.linkText, { color: colors.primary }]}>
          Add Video / View Analysis
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessible
      accessibilityLabel="Record form video"
      accessibilityRole="button"
    >
      <Text style={styles.icon}>📹</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 20, marginLeft: spacing[2] },
  link: { marginTop: spacing[2], marginBottom: spacing[1] },
  linkText: { fontSize: typography.sizes.sm, fontWeight: '600' as const },
});
