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

import { useAuth } from '@modules/auth';
import { captureException } from '@platform/utils/captureException';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { syncWearableData } from '../application/sync.service';
import { useRecoverySnapshot } from '../hooks/useRecoverySnapshot';
import { useWearableStatus } from '../hooks/useWearableStatus';
import { openSettings, requestPermissions } from '../lib/health-connect';
import { mapAutonomicToLevel, mapSleepDurationToLevel } from '../utils/prefill';

type Snapshot = NonNullable<ReturnType<typeof useRecoverySnapshot>['data']>;

function formatHours(min: number | null): string {
  if (min === null) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

function formatPct(pct: number | null): string {
  if (pct === null) return '—';
  const sign = pct >= 0 ? '+' : '−';
  return `${sign}${Math.abs(Math.round(pct))}%`;
}

function formatNumber(n: number | null): string {
  if (n === null) return '—';
  return Math.round(n).toLocaleString();
}

function formatHrv(snapshot: Snapshot): string {
  if (snapshot.hrv_rmssd === null) return '—';
  const ms = `${Math.round(snapshot.hrv_rmssd)} ms`;
  if (snapshot.hrv_pct_change === null) return ms;
  return `${ms} (${formatPct(snapshot.hrv_pct_change)} vs 7d)`;
}

function formatRhr(snapshot: Snapshot): string {
  if (snapshot.resting_hr === null) return '—';
  const bpm = `${Math.round(snapshot.resting_hr)} bpm`;
  if (snapshot.rhr_pct_change === null) return bpm;
  return `${bpm} (${formatPct(snapshot.rhr_pct_change)} vs 7d)`;
}

function formatSleepStages(snapshot: Snapshot): string {
  const deep =
    snapshot.deep_sleep_pct !== null
      ? `${Math.round(snapshot.deep_sleep_pct)}%`
      : '—';
  const rem =
    snapshot.rem_sleep_pct !== null
      ? `${Math.round(snapshot.rem_sleep_pct)}%`
      : '—';
  return `${deep} / ${rem}`;
}

function formatScore(score: number | null): string {
  if (score === null) return '—';
  return `${Math.round(score)} / 100`;
}

function formatPillLevel(level: 1 | 2 | 3 | 4 | 5 | null): string {
  if (level === null) return '—';
  return `${level} / 5`;
}

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
    readingsTitle: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing[3],
    },
    readingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingVertical: spacing[1.5],
    },
    readingRowIndent: {
      paddingLeft: spacing[3],
    },
    readingLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    readingValue: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      fontWeight: typography.weights.medium,
    },
    readingsDivider: {
      height: 1,
      backgroundColor: colors.borderMuted,
      marginVertical: spacing[3],
    },
    readingsSubtitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing[1],
    },
    readingsEmpty: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
    },
  });
}

interface ReadingRowProps {
  label: string;
  value: string;
  indent?: boolean;
  styles: ReturnType<typeof buildStyles>;
}

function ReadingRow({ label, value, indent, styles }: ReadingRowProps) {
  return (
    <View style={[styles.readingRow, indent && styles.readingRowIndent]}>
      <Text style={styles.readingLabel}>{label}</Text>
      <Text style={styles.readingValue}>{value}</Text>
    </View>
  );
}

interface ReadingsCardProps {
  snapshot: Snapshot | null;
  styles: ReturnType<typeof buildStyles>;
}

function ReadingsCard({ snapshot, styles }: ReadingsCardProps) {
  if (!snapshot) {
    return (
      <View style={styles.statusCard}>
        <Text style={styles.readingsTitle}>Today&apos;s readings</Text>
        <Text style={styles.readingsEmpty}>
          No readings yet — tap Sync now.
        </Text>
      </View>
    );
  }

  const sleepPill = mapSleepDurationToLevel(snapshot.sleep_duration_min);
  const energyPill = mapAutonomicToLevel(
    snapshot.hrv_pct_change,
    snapshot.rhr_pct_change
  );

  return (
    <View style={styles.statusCard}>
      <Text style={styles.readingsTitle}>Today&apos;s readings</Text>
      <ReadingRow
        label="Sleep"
        value={formatHours(snapshot.sleep_duration_min)}
        styles={styles}
      />
      <ReadingRow
        label="Deep / REM"
        value={formatSleepStages(snapshot)}
        indent
        styles={styles}
      />
      <ReadingRow label="HRV" value={formatHrv(snapshot)} styles={styles} />
      <ReadingRow
        label="Resting HR"
        value={formatRhr(snapshot)}
        styles={styles}
      />
      <ReadingRow
        label="Steps today"
        value={formatNumber(snapshot.steps_24h)}
        styles={styles}
      />
      <ReadingRow
        label="Active mins"
        value={formatNumber(snapshot.active_minutes_24h)}
        styles={styles}
      />
      <ReadingRow
        label="Readiness score"
        value={formatScore(snapshot.readiness_score)}
        styles={styles}
      />
      <View style={styles.readingsDivider} />
      <Text style={styles.readingsSubtitle}>Soreness prefill preview</Text>
      <ReadingRow
        label="Sleep pill"
        value={formatPillLevel(sleepPill)}
        indent
        styles={styles}
      />
      <ReadingRow
        label="Energy pill"
        value={formatPillLevel(energyPill)}
        indent
        styles={styles}
      />
    </View>
  );
}

export function WearableSettings() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { user } = useAuth();
  const status = useWearableStatus();
  const { data: recoverySnapshot } = useRecoverySnapshot();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  async function handleConnect() {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const result = await requestPermissions();
      await status.refresh();
      if (!result.granted) {
        Alert.alert(
          'Permissions not granted',
          'Parakeet needs read access in Health Connect. Open Health Connect settings to grant permissions.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openSettings() },
          ]
        );
      }
    } catch (err) {
      captureException(err);
      Alert.alert('Error', 'Could not request permissions. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }

  function handleInstallHealthConnect() {
    try {
      openSettings();
    } catch (err) {
      captureException(err);
      Alert.alert(
        'Health Connect required',
        'Install or update Health Connect from the Play Store, then return here.'
      );
    }
  }

  async function handleSyncNow() {
    if (!user?.id || isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncWearableData(user.id);
      if (result.synced) {
        Alert.alert(
          'Sync complete',
          `${result.readingsInserted} new readings saved.`
        );
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
      const detail = err instanceof Error ? err.message : String(err);
      Alert.alert('Sync failed', detail);
    } finally {
      setIsSyncing(false);
    }
  }

  let dotColor: string;
  if (!status.isAvailable) {
    dotColor =
      status.availability === 'provider_update_required'
        ? colors.warning
        : colors.textTertiary;
  } else {
    dotColor = status.isPermitted ? colors.success : colors.warning;
  }

  let statusText: string;
  if (status.availability === 'provider_update_required') {
    statusText = 'Health Connect needs to be installed or updated';
  } else if (!status.isAvailable) {
    statusText = 'Not available on this device';
  } else {
    statusText = status.isPermitted ? 'Connected' : 'Permissions needed';
  }

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

      {status.isAvailable && status.isPermitted && (
        <ReadingsCard snapshot={recoverySnapshot ?? null} styles={styles} />
      )}

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

      {status.availability === 'provider_update_required' && (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleInstallHealthConnect}
          activeOpacity={0.7}
        >
          <Text style={styles.primaryBtnText}>Install Health Connect</Text>
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
