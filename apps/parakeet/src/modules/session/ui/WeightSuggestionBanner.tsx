// @spec docs/features/session/spec-performance.md
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ColorScheme } from '../../../theme';
import type { WeightSuggestionOffer } from '../model/types';

interface Props {
  suggestion: WeightSuggestionOffer;
  colors: ColorScheme;
  onAccept: () => void;
  onDismiss: () => void;
}

export function WeightSuggestionBanner({
  suggestion,
  colors,
  onAccept,
  onDismiss,
}: Props) {
  const styles = buildStyles(colors);
  return (
    <View style={styles.banner}>
      <View style={styles.textRow}>
        <Text style={styles.title}>
          Felt easy — try {suggestion.suggestedWeightKg} kg?
        </Text>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={styles.dismiss}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.rationale}>{suggestion.rationale}</Text>
      <Pressable style={styles.acceptButton} onPress={onAccept}>
        <Text style={styles.acceptButtonText}>+{suggestion.deltaKg} kg</Text>
      </Pressable>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    banner: {
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    textRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      flex: 1,
    },
    dismiss: {
      fontSize: 16,
      color: colors.textSecondary,
      paddingLeft: 8,
    },
    rationale: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    acceptButton: {
      marginTop: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    acceptButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textInverse,
    },
  });
}
