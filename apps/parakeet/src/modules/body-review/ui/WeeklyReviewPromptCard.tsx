import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ColorScheme } from '../../../theme';

/**
 * Card shown on the session completion screen when end-of-week review is due.
 * Renders inline after the save-success state — user can launch the review
 * immediately or skip (defer to today-screen nudge).
 */
export function WeeklyReviewPromptCard({
  colors,
  onReview,
  onSkip,
}: {
  colors: ColorScheme;
  onReview: () => void;
  onSkip: () => void;
}) {
  const styles = buildStyles(colors);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>End of week — how does your body feel?</Text>
      <Text style={styles.subtitle}>
        Compare how you feel vs what the system predicted
      </Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.reviewButton}
          onPress={onReview}
          activeOpacity={0.8}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Open weekly body review"
        >
          <Text style={styles.reviewButtonText}>Review</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          activeOpacity={0.7}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Skip weekly body review"
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 18,
      marginBottom: 20,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 16,
      lineHeight: 18,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
    },
    reviewButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    reviewButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textInverse,
    },
    skipButton: {
      flex: 1,
      backgroundColor: colors.bgMuted,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      alignItems: 'center',
    },
    skipButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
}
