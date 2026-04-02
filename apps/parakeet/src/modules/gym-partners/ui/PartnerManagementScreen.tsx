import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { ColorScheme } from '../../../theme';
import { spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import {
  useAcceptPartner,
  useDeclinePartner,
  usePartners,
  useRemovePartner,
} from '../hooks/usePartners';
import type { GymPartner } from '../model/types';
import { MAX_PARTNERS } from '../model/types';
import { QrGenerateSheet } from './QrGenerateSheet';
import { QrScanSheet } from './QrScanSheet';

export function PartnerManagementScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { partners, pendingRequests, isLoading } = usePartners();
  const { acceptPartner } = useAcceptPartner();
  const { declinePartner } = useDeclinePartner();
  const { removePartner } = useRemovePartner();

  const [showQrGenerate, setShowQrGenerate] = useState(false);
  const [showQrScan, setShowQrScan] = useState(false);

  const atCap = partners.length >= MAX_PARTNERS;

  const handleAddPartner = useCallback(() => {
    if (atCap) {
      Alert.alert(
        'Partner Limit',
        `You already have the maximum of ${MAX_PARTNERS} partners.`
      );
      return;
    }
    Alert.alert('Add Partner', 'How would you like to pair?', [
      { text: 'Show My QR', onPress: () => setShowQrGenerate(true) },
      { text: 'Scan QR', onPress: () => setShowQrScan(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [atCap]);

  const handleRemove = useCallback(
    (partner: GymPartner) => {
      Alert.alert(
        'Remove Partner',
        `Remove ${partner.partnerName} as a gym partner? They won't be able to film for you anymore.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removePartner({ partnershipId: partner.id }),
          },
        ]
      );
    },
    [removePartner]
  );

  const handleAccept = useCallback(
    (partner: GymPartner) => {
      acceptPartner({ partnershipId: partner.id });
    },
    [acceptPartner]
  );

  const handleDecline = useCallback(
    (partner: GymPartner) => {
      declinePartner({ partnershipId: partner.id });
    },
    [declinePartner]
  );

  const renderPartner = useCallback(
    ({ item }: { item: GymPartner }) => (
      <TouchableOpacity
        style={styles.partnerRow}
        onLongPress={() => handleRemove(item)}
        activeOpacity={0.7}
        accessibilityLabel={`${item.partnerName}, long press to remove`}
        accessibilityRole="button"
      >
        <View style={styles.partnerInfo}>
          <Text style={styles.partnerName}>{item.partnerName}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleRemove(item)}
          hitSlop={8}
          accessibilityLabel={`Remove ${item.partnerName}`}
          accessibilityRole="button"
        >
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [styles, handleRemove]
  );

  const renderPending = useCallback(
    ({ item }: { item: GymPartner }) => (
      <View style={styles.pendingRow}>
        <Text style={[styles.partnerName, { flex: 1 }]}>
          {item.partnerName}
        </Text>
        <View style={styles.pendingActions}>
          <TouchableOpacity
            onPress={() => handleAccept(item)}
            style={styles.acceptButton}
            activeOpacity={0.7}
            accessibilityLabel={`Accept ${item.partnerName}`}
            accessibilityRole="button"
          >
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDecline(item)}
            style={styles.declineButton}
            activeOpacity={0.7}
            accessibilityLabel={`Decline ${item.partnerName}`}
            accessibilityRole="button"
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [styles, handleAccept, handleDecline]
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Requests</Text>
          <FlatList
            data={pendingRequests}
            renderItem={renderPending}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Partners</Text>
          <TouchableOpacity
            onPress={handleAddPartner}
            hitSlop={8}
            accessibilityLabel="Add partner"
            accessibilityRole="button"
          >
            <Text style={styles.addButton}>+</Text>
          </TouchableOpacity>
        </View>

        {partners.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No gym partners yet.{'\n'}Add one to start filming each other's
              lifts.
            </Text>
            <TouchableOpacity
              onPress={handleAddPartner}
              style={styles.addPartnerButton}
              activeOpacity={0.7}
            >
              <Text style={styles.addPartnerText}>Add Partner</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={partners}
            renderItem={renderPartner}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}
      </View>

      <QrGenerateSheet
        visible={showQrGenerate}
        onClose={() => setShowQrGenerate(false)}
      />
      <QrScanSheet visible={showQrScan} onClose={() => setShowQrScan(false)} />
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: spacing[4],
      marginTop: spacing[4],
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    section: {
      gap: spacing[2],
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    addButton: {
      fontSize: typography.sizes.xl,
      color: colors.primary,
      fontWeight: typography.weights.bold,
      lineHeight: typography.sizes['2xl'],
    },
    partnerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    partnerInfo: {
      flex: 1,
    },
    partnerName: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    removeText: {
      fontSize: typography.sizes.sm,
      color: colors.danger,
    },
    pendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    pendingActions: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    acceptButton: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    acceptText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
    declineButton: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    declineText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing[6],
      gap: spacing[3],
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    addPartnerButton: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    addPartnerText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
  });
}
