import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ColorScheme } from '../../../theme';
import type { RecoveryOffer } from '../model/types';

interface Props {
  offer: RecoveryOffer;
  colors: ColorScheme;
  onAccept: () => void;
  onDismiss: () => void;
}

export function VolumeRecoveryBanner({
  offer,
  colors,
  onAccept,
  onDismiss,
}: Props) {
  const styles = buildStyles(colors);
  return (
    <View style={styles.banner}>
      <View style={styles.textRow}>
        <Text style={styles.title}>
          Feeling strong? Add {offer.setsAvailable} set
          {offer.setsAvailable > 1 ? 's' : ''} back
        </Text>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={styles.dismiss}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.rationale}>{offer.rationale}</Text>
      <Pressable style={styles.addButton} onPress={onAccept}>
        <Text style={styles.addButtonText}>Add Sets</Text>
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
      backgroundColor: colors.successMuted,
      borderWidth: 1,
      borderColor: colors.success,
    },
    textRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.success,
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
    addButton: {
      marginTop: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.success,
    },
    addButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textInverse,
    },
  });
}
