import { ScrollView, StyleSheet, Text, TextStyle, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

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

  // Badge for pending AI formula suggestions
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

  const hasSuggestions = (pendingSuggestions ?? 0) > 0;
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
          onPress={() => {/* TODO: data-002 settings */}}
        />
        <Row
          label="Warmup Protocol"
          onPress={() => {/* TODO: data-003 settings */}}
        />
        <Row
          label="Volume Config (MRV/MEV)"
          onPress={() => {/* TODO: data-001 settings */}}
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
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 32,
  },
  // Profile
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 24,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  emailText: {
    fontSize: 15,
    color: '#111827',
    flexShrink: 1,
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  // Section header
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowLabel: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
    lineHeight: 22,
  },
  suggestionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  signOutLabel: {
    color: '#dc2626',
  },
  versionLabel: {
    color: '#9ca3af',
  },
});
