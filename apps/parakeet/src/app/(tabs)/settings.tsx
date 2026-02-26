import { ScrollView, StyleSheet, Text, TextStyle, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { getProfile } from '../../lib/profile';
import { qk } from '../../queries/keys';
import {
  getPendingFormulaSuggestionCount,
  getUnreviewedDeveloperSuggestionCount,
} from '../../services/settings.service';
import { colors, spacing, radii, typography } from '../../theme';

// ── Sub-components ────────────────────────────────────────────────────────────

const SEX_LABEL: Record<string, string> = {
  female: 'Female',
  male: 'Male',
};

interface SectionHeaderProps {
  label: string;
}

function SectionHeader({ label }: SectionHeaderProps) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

interface RowProps {
  label: string;
  labelStyle?: TextStyle;
  onPress?: () => void;
  right?: React.ReactNode;
}

function Row({ label, labelStyle, onPress, right }: RowProps) {
  if (onPress) {
    return (
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  const { data: pendingSuggestions } = useQuery({
    queryKey: qk.formula.suggestionsCount(user?.id),
    queryFn: () => getPendingFormulaSuggestionCount(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const { data: unreviewedDevCount } = useQuery({
    queryKey: qk.developer.suggestionsCount(),
    queryFn: getUnreviewedDeveloperSuggestionCount,
    staleTime: 60 * 1000,
  });

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: qk.profile.current(),
    queryFn: getProfile,
    staleTime: 5 * 60 * 1000,
  });

  const hasSuggestions = (pendingSuggestions ?? 0) > 0;
  const hasDevSuggestions = (unreviewedDevCount ?? 0) > 0;

  const sexLabel = profile?.biological_sex
    ? (SEX_LABEL[profile.biological_sex] ?? profile.biological_sex)
    : '—';

  const birthYear = profile?.date_of_birth
    ? new Date(profile.date_of_birth).getFullYear().toString()
    : '—';

  const displayName = profile?.display_name ?? '—';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Settings</Text>

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
            <Text style={styles.inlineInfoValue}>{isProfileLoading ? 'Loading…' : displayName}</Text>
          </View>
          <View style={styles.inlineInfoRow}>
            <Text style={styles.inlineInfoLabel}>Gender</Text>
            <Text style={styles.inlineInfoValue}>{isProfileLoading ? 'Loading…' : sexLabel}</Text>
          </View>
          <View style={styles.inlineInfoRow}>
            <Text style={styles.inlineInfoLabel}>Birth year</Text>
            <Text style={styles.inlineInfoValue}>{isProfileLoading ? 'Loading…' : birthYear}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Achievements section */}
        <SectionHeader label="Achievements" />
        <Row
          label="Achievements"
          onPress={() => router.push('/profile/achievements')}
        />
        <Row
          label="WILKS Score"
          onPress={() => router.push('/profile/wilks')}
        />

        <View style={styles.divider} />

        {/* Training section */}
        <SectionHeader label="Training" />
        <Row
          label="Manage Formulas"
          onPress={() => router.push('/formula/editor')}
          right={
            <View style={styles.rowRight}>
              {hasSuggestions && <View style={styles.suggestionDot} />}
              <Text style={styles.chevron}>›</Text>
            </View>
          }
        />
        <Row
          label="Report Issue"
          onPress={() => router.push('/disruption-report/report')}
        />
        <Row
          label="Volume & Recovery"
          onPress={() => router.push('/volume')}
        />

        <View style={styles.divider} />

        {/* Advanced section */}
        <SectionHeader label="Advanced" />
        <Row
          label="Auxiliary Exercises"
          onPress={() => router.push('/settings/auxiliary-exercises')}
        />
        <Row
          label="Warmup Protocol"
          onPress={() => router.push('/settings/warmup-protocol')}
        />
        <Row
          label="Rest Timer"
          onPress={() => router.push('/settings/rest-timer')}
        />
        <Row
          label="Volume Config (MRV/MEV)"
          onPress={() => router.push('/settings/volume-config')}
        />
        <Row
          label="Developer"
          onPress={() => router.push('/settings/developer')}
          right={
            <View style={styles.rowRight}>
              {hasDevSuggestions && <View style={styles.suggestionDot} />}
              <Text style={styles.chevron}>›</Text>
            </View>
          }
        />

        <View style={styles.divider} />

        {/* Account section */}
        <SectionHeader label="Account" />
        <Row
          label="Sign Out"
          labelStyle={styles.signOutLabel}
          onPress={signOut}
          right={null}
        />

        <View style={styles.divider} />

        {/* App section */}
        <SectionHeader label="App" />
        <Row
          label="Version 0.1.0"
          labelStyle={styles.versionLabel}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[12],
  },
  screenTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: spacing[6],
    letterSpacing: typography.letterSpacing.tight,
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
});
