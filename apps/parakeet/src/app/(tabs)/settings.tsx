import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@modules/auth';
import { useFeatureEnabled } from '@modules/feature-flags';
import { formatBirthYear, formatBodyweight } from '@modules/profile';
import {
  exportTrainingData,
  getBarWeightKg,
  getWarmupPlateDisplay,
  setBarWeightKg,
  setWarmupPlateDisplay,
  useSettingsBadges,
} from '@modules/settings';
import type { BarWeightKg, WarmupPlateDisplay } from '@modules/settings';
import { useOtaUpdateStatus } from '@modules/updates';
import type { OtaStatus } from '@modules/updates';
import { SEX_LABELS, THEME_OPTIONS } from '@shared/constants';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import { radii, spacing, typography } from '../../theme';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

function otaStatusLabel(status: OtaStatus, _error: string | null): string {
  switch (status) {
    case 'checking':
      return 'Checking for updates…';
    case 'downloading':
      return 'Downloading update…';
    case 'ready':
      return 'Update ready — tap to restart';
    case 'restarting':
      return 'Restarting…';
    case 'error':
      return 'Update check failed — tap to retry';
    case 'up-to-date':
      return 'Up to date';
    default:
      return 'Check for updates';
  }
}

function formatTimeAgo(epochMs: number | null) {
  if (epochMs == null) return null;
  const seconds = Math.floor((Date.now() - epochMs) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatBuildDate(otaCreatedAt: Date | null) {
  const source =
    otaCreatedAt ??
    (Constants.expoConfig?.extra?.buildDate
      ? new Date(Constants.expoConfig.extra.buildDate as string)
      : null);
  if (!source) return __DEV__ ? 'dev' : '—';
  return source.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  styles: ReturnType<typeof buildStyles>;
}

function SectionHeader({ label, styles }: SectionHeaderProps) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

interface RowProps {
  label: string;
  labelStyle?: TextStyle;
  onPress?: () => void;
  right?: React.ReactNode;
  styles: ReturnType<typeof buildStyles>;
}

function Row({ label, labelStyle, onPress, right, styles }: RowProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        activeOpacity={0.6}
      >
        <Text style={[styles.rowLabel, labelStyle]}>{label}</Text>
        {right ?? <Text style={styles.chevron}>›</Text>}
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, labelStyle]}>{label}</Text>
      {right}
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollView: {
      flex: 1,
    },
    container: {
      paddingHorizontal: spacing[5],
      paddingBottom: spacing[12],
    },
    profileInlineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing[3],
    },
    profileInlineHeaderTextWrap: {
      flex: 1,
      marginRight: spacing[3],
    },
    profileInlineTitle: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.widest,
      marginBottom: spacing[1],
    },
    editButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1.5],
      backgroundColor: colors.bgSurface,
    },
    editButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    emailText: {
      fontSize: typography.sizes.base,
      color: colors.textSecondary,
    },
    inlineInfoWrap: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.borderMuted,
    },
    inlineInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing[2.5],
    },
    inlineInfoLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    inlineInfoValue: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    // Divider
    divider: {
      height: 1,
      backgroundColor: colors.borderMuted,
      marginVertical: spacing[4],
    },
    // Section header
    sectionHeader: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.widest,
      marginBottom: spacing[1],
    },
    // Rows
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[4],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    rowLabel: {
      fontSize: typography.sizes.base,
      color: colors.text,
      flex: 1,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1.5],
    },
    chevron: {
      fontSize: 22,
      color: colors.textTertiary,
      lineHeight: 24,
    },
    suggestionDot: {
      width: 8,
      height: 8,
      borderRadius: radii.full,
      backgroundColor: colors.primary,
    },
    signOutLabel: {
      color: colors.danger,
    },
    versionLabel: {
      color: colors.textTertiary,
    },
    buildDate: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
    },
    devBadge: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.primary,
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: spacing[1.5],
      paddingVertical: 2,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    toggleGroup: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    toggleBtn: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgMuted,
    },
    toggleBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    toggleBtnText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
    },
    toggleBtnTextActive: {
      color: colors.primary,
    },
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colors, themeName, setTheme } = useTheme();
  const { user, signOut } = useAuth();

  const styles = useMemo(() => buildStyles(colors), [colors]);

  const [barWeightKg, setBarWeightKgState] = useState<BarWeightKg>(20);
  const [plateDisplay, setPlateDisplayState] =
    useState<WarmupPlateDisplay>('numbers');

  const {
    status: otaStatus,
    error: otaError,
    meta: otaMeta,
    lastCheckedAt: otaLastCheckedAt,
    checkForUpdate,
    applyUpdate,
  } = useOtaUpdateStatus();

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!user?.id || isExporting) return;
    setIsExporting(true);
    try {
      await exportTrainingData(user.id);
    } finally {
      setIsExporting(false);
    }
  }, [user?.id, isExporting]);

  async function handleBarWeightChange(kg: BarWeightKg) {
    setBarWeightKgState(kg);
    await setBarWeightKg(kg);
  }

  const { pendingSuggestions, unreviewedDevCount, profile, isProfileLoading } =
    useSettingsBadges();

  useEffect(() => {
    getBarWeightKg(profile?.biological_sex).then(setBarWeightKgState);
    getWarmupPlateDisplay().then(setPlateDisplayState);
  }, [profile?.biological_sex]);

  const showAchievements = useFeatureEnabled('achievements');
  const showWilks = useFeatureEnabled('wilks');
  const showVolume = useFeatureEnabled('volumeDashboard');
  const showAuxiliary = useFeatureEnabled('auxiliary');
  const showWarmups = useFeatureEnabled('warmups');
  const showRestTimer = useFeatureEnabled('restTimer');
  const showCycleTracking = useFeatureEnabled('cycleTracking');
  const showDeveloper = useFeatureEnabled('developer');
  const showFormulaSuggestions = useFeatureEnabled('formulaSuggestions');
  const showGymPartner = useFeatureEnabled('gymPartner');

  const hasSuggestions = (pendingSuggestions ?? 0) > 0;
  const hasDevSuggestions = (unreviewedDevCount ?? 0) > 0;

  const sexLabel = profile?.biological_sex
    ? (SEX_LABELS[profile.biological_sex] ?? profile.biological_sex)
    : '—';

  const birthYear = formatBirthYear(profile?.date_of_birth);

  const displayName = profile?.display_name ?? '—';

  const bodyweightKg = formatBodyweight(profile?.bodyweight_kg);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader>
        <ScreenTitle>Settings</ScreenTitle>
      </ScreenHeader>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileInlineHeader}>
          <View style={styles.profileInlineHeaderTextWrap}>
            <Text style={styles.profileInlineTitle}>Profile</Text>
            <Text style={styles.emailText}>{user?.email ?? '—'}</Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inlineInfoWrap}>
          <View style={styles.inlineInfoRow}>
            <Text style={styles.inlineInfoLabel}>Name</Text>
            <Text style={styles.inlineInfoValue}>
              {isProfileLoading ? 'Loading…' : displayName}
            </Text>
          </View>
          <View style={styles.inlineInfoRow}>
            <Text style={styles.inlineInfoLabel}>Gender</Text>
            <Text style={styles.inlineInfoValue}>
              {isProfileLoading ? 'Loading…' : sexLabel}
            </Text>
          </View>
          <View style={styles.inlineInfoRow}>
            <Text style={styles.inlineInfoLabel}>Birth year</Text>
            <Text style={styles.inlineInfoValue}>
              {isProfileLoading ? 'Loading…' : birthYear}
            </Text>
          </View>
          <View style={styles.inlineInfoRow}>
            <Text style={styles.inlineInfoLabel}>Bodyweight</Text>
            <Text style={styles.inlineInfoValue}>
              {isProfileLoading ? 'Loading…' : bodyweightKg}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Achievements section */}
        {(showAchievements || showWilks) && (
          <>
            <SectionHeader label="Achievements" styles={styles} />
            {showAchievements && (
              <Row
                label="Achievements"
                onPress={() => router.push('/profile/achievements')}
                styles={styles}
              />
            )}
            {showWilks && (
              <Row
                label="WILKS Score"
                onPress={() => router.push('/profile/wilks')}
                styles={styles}
              />
            )}
            <View style={styles.divider} />
          </>
        )}

        {/* Training section */}
        <SectionHeader label="Training" styles={styles} />
        <Row
          label="Bar Weight"
          styles={styles}
          right={
            <View style={styles.toggleGroup}>
              {([15, 20] as BarWeightKg[]).map((kg) => (
                <TouchableOpacity
                  key={kg}
                  style={[
                    styles.toggleBtn,
                    barWeightKg === kg && styles.toggleBtnActive,
                  ]}
                  onPress={() => handleBarWeightChange(kg)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.toggleBtnText,
                      barWeightKg === kg && styles.toggleBtnTextActive,
                    ]}
                  >
                    {kg} kg
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />
        <Row
          label="Plate Indicator"
          styles={styles}
          right={
            <View style={styles.toggleGroup}>
              {(['numbers', 'colors'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.toggleBtn,
                    plateDisplay === mode && styles.toggleBtnActive,
                  ]}
                  onPress={() => {
                    setPlateDisplayState(mode);
                    setWarmupPlateDisplay(mode);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.toggleBtnText,
                      plateDisplay === mode && styles.toggleBtnTextActive,
                    ]}
                  >
                    {mode === 'numbers' ? 'Numbers' : 'Colors'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />
        <Row
          label="Training Days"
          onPress={() => router.push('/settings/training-days')}
          styles={styles}
        />
        <Row
          label="Manage Formulas"
          onPress={() => router.push('/formula/editor')}
          styles={styles}
          right={
            <View style={styles.rowRight}>
              {showFormulaSuggestions && hasSuggestions && (
                <View style={styles.suggestionDot} />
              )}
              <Text style={styles.chevron}>›</Text>
            </View>
          }
        />
        {showVolume && (
          <Row
            label="Volume & Recovery"
            onPress={() => router.push('/volume')}
            styles={styles}
          />
        )}

        <View style={styles.divider} />

        {/* Advanced section */}
        <SectionHeader label="Advanced" styles={styles} />
        <Row
          label="Features"
          onPress={() => router.push('/settings/features')}
          styles={styles}
        />
        {showAuxiliary && (
          <Row
            label="Auxiliary Exercises"
            onPress={() => router.push('/settings/auxiliary-exercises')}
            styles={styles}
          />
        )}
        {showWarmups && (
          <Row
            label="Warmup Protocol"
            onPress={() => router.push('/settings/warmup-protocol')}
            styles={styles}
          />
        )}
        {showRestTimer && (
          <Row
            label="Rest Timer"
            onPress={() => router.push('/settings/rest-timer')}
            styles={styles}
          />
        )}
        {showVolume && (
          <Row
            label="Volume Config (MRV/MEV)"
            onPress={() => router.push('/settings/volume-config')}
            styles={styles}
          />
        )}
        {showCycleTracking && profile?.biological_sex === 'female' && (
          <Row
            label="Cycle Tracking"
            onPress={() => router.push('/settings/cycle-tracking')}
            styles={styles}
          />
        )}
        {showGymPartner && (
          <Row
            label="Gym Partners"
            onPress={() => router.push('/settings/gym-partners')}
            styles={styles}
          />
        )}
        {showDeveloper && (
          <Row
            label="Developer"
            onPress={() => router.push('/settings/developer')}
            styles={styles}
            right={
              <View style={styles.rowRight}>
                {hasDevSuggestions && <View style={styles.suggestionDot} />}
                <Text style={styles.chevron}>›</Text>
              </View>
            }
          />
        )}

        <View style={styles.divider} />

        {/* Appearance section */}
        <SectionHeader label="Appearance" styles={styles} />
        <Row
          label="Theme"
          styles={styles}
          right={
            <View style={styles.toggleGroup}>
              {THEME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.toggleBtn,
                    themeName === opt.key && styles.toggleBtnActive,
                  ]}
                  onPress={() => setTheme(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.toggleBtnText,
                      themeName === opt.key && styles.toggleBtnTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />

        <View style={styles.divider} />

        {/* Account section */}
        <SectionHeader label="Account" styles={styles} />
        <Row
          label={isExporting ? 'Exporting…' : 'Export Data'}
          onPress={handleExport}
          styles={styles}
        />
        <Row
          label="Sign Out"
          labelStyle={styles.signOutLabel}
          onPress={signOut}
          right={null}
          styles={styles}
        />

        <View style={styles.divider} />

        {/* App section */}
        <SectionHeader label="App" styles={styles} />
        <Row
          label={`Version ${Constants.expoConfig?.version ?? '—'}  ·  ${otaMeta.updateId ? otaMeta.updateId.slice(0, 8) : ((Constants.expoConfig?.extra?.commitHash as string) ?? '—')}`}
          labelStyle={styles.versionLabel}
          styles={styles}
          right={
            <View style={styles.rowRight}>
              {__DEV__ && <Text style={styles.devBadge}>DEV</Text>}
            </View>
          }
        />
        <Row
          label={`Running build from ${formatBuildDate(otaMeta.createdAt)}`}
          labelStyle={styles.versionLabel}
          styles={styles}
        />
        <Row
          label={otaStatusLabel(otaStatus, otaError)}
          labelStyle={
            otaStatus === 'error'
              ? styles.signOutLabel
              : otaStatus === 'up-to-date'
                ? styles.versionLabel
                : undefined
          }
          onPress={
            otaStatus === 'checking' ||
            otaStatus === 'downloading' ||
            otaStatus === 'restarting'
              ? undefined
              : otaStatus === 'ready'
                ? applyUpdate
                : checkForUpdate
          }
          styles={styles}
          right={
            otaLastCheckedAt ? (
              <Text style={styles.buildDate}>
                {formatTimeAgo(otaLastCheckedAt)}
              </Text>
            ) : null
          }
        />
        <Row
          label="Log New Issue"
          onPress={() =>
            Linking.openURL('https://github.com/rek/parakeet/issues/new')
          }
          styles={styles}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
