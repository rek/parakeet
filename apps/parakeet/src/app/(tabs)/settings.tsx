import { ScrollView, StyleSheet, Text, TextStyle, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radii, typography } from '../../theme';

// ── Sub-components ────────────────────────────────────────────────────────────

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
    queryKey: ['formula', 'suggestions', 'count', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('formula_configs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('source', 'ai_suggestion')
        .eq('is_active', false);
      return count ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const { data: unreviewedDevCount } = useQuery({
    queryKey: ['developer', 'suggestions', 'count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('developer_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'unreviewed');
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });

  const hasSuggestions = (pendingSuggestions ?? 0) > 0;
  const hasDevSuggestions = (unreviewedDevCount ?? 0) > 0;
  const emailInitial = user?.email ? user.email[0].toUpperCase() : '?';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Settings</Text>

        {/* Profile section */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{emailInitial}</Text>
          </View>
          <Text style={styles.emailText}>{user?.email ?? '—'}</Text>
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
    marginBottom: spacing[8],
    letterSpacing: typography.letterSpacing.tight,
  },
  // Profile
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    marginBottom: spacing[6],
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3.5],
  },
  avatarInitial: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  emailText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    flexShrink: 1,
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
