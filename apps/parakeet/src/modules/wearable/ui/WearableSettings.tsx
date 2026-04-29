import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { captureException } from '@platform/utils/captureException';
import { useAuth } from '@modules/auth';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { syncWearableData } from '../application/sync.service';
import { requestPermissions } from '../lib/health-connect';
import { useWearableStatus } from '../hooks/useWearableStatus';

function formatTimeAgo(epochMs: number | null): string {
  if (epochMs == null) return 'Never';
  const seconds = Math.floor((Date.now() - epochMs) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[6],
      paddingBottom: spacing[12],
    },
    statusCard: {
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing[4],
      marginBottom: spacing[4],
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing[2],
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: radii.full,
      marginRight: spacing[2],
    },
    statusLabel: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    statusSub: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginTop: spacing[1],
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderMuted,
      marginVertical: spacing[3],
    },
    syncRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    syncLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2.5],
      alignItems: 'center',
      marginBottom: spacing[3],
    },
    primaryBtnText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2.5],
      alignItems: 'center',
    },
    secondaryBtnText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    note: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      lineHeight: 18,
      marginTop: spacing[4],
    },
  });
}

export function WearableSettings() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { user } = useAuth();
  const status = useWearableStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  async function handleConnect() {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      await requestPermissions();
    } catch (err) {
      captureException(err);
      Alert.alert('Error', 'Could not request permissions. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleSyncNow() {
    if (!user?.id || isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncWearableData(user.id);
      if (result.synced) {
        Alert.alert('Sync complete', `${result.readingsInserted} new readings saved.`);
      } else {
        Alert.alert(
          'Sync skipped',
          result.reason === 'unavailable'
            ? 'Health Connect is not available on this device.'
            : 'Permissions not granted. Tap "Connect Health Data" first.'
        );
      }
    } catch (err) {
      captureException(err);
      Alert.alert('Sync failed', 'Could not sync health data. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  }

  const dotColor = !status.isAvailable
    ? colors.textTertiary
    : status.isPermitted
      ? colors.success
      : colors.warning;

  const statusText = !status.isAvailable
    ? 'Not available on this device'
    : status.isPermitted
      ? 'Connected'
      : 'Permissions needed';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={styles.statusLabel}>{statusText}</Text>
        </View>

        {status.isAvailable && (
          <>
            <View style={styles.divider} />
            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>
                Last sync: {formatTimeAgo(status.lastSyncAt)}
              </Text>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleSyncNow}
                disabled={isSyncing}
                activeOpacity={0.7}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={styles.secondaryBtnText}>Sync now</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {status.isAvailable && !status.isPermitted && (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleConnect}
          disabled={isConnecting}
          activeOpacity={0.7}
        >
          {isConnecting ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={styles.primaryBtnText}>Connect Health Data</Text>
          )}
        </TouchableOpacity>
      )}

      <Text style={styles.note}>
        Parakeet reads HRV, resting heart rate, sleep, steps, and SpO2 from
        Health Connect to compute a daily readiness score. This score adjusts
        your training intensity automatically. Readings are stored privately in
        your account and never shared.
      </Text>
    </ScrollView>
  );
}
