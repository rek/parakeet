import { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useWilksProfile } from '@modules/achievements';
import { useAuth } from '@modules/auth';
import { WILKS_CONTEXT } from '@modules/wilks';
import { formatDate } from '@shared/utils/date';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../components/navigation/BackLink';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bgSurface,
    },
    scrollView: {
      flex: 1,
    },
    container: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 48,
    },
    centered: {
      paddingTop: 64,
      alignItems: 'center',
    },
    // Current score card
    currentCard: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginBottom: 24,
    },
    currentScoreLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    currentScore: {
      fontSize: 56,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    currentMeta: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    bwLink: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    sectionHeader: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 4,
      marginBottom: 20,
    },
    // Lifts used
    liftRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.bgMuted,
    },
    liftRowLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    liftRowValue: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    // History
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.bgMuted,
    },
    historyLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    historyDate: {
      fontSize: 13,
      color: colors.textSecondary,
      marginRight: 16,
    },
    historyScore: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    // Reference
    refRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.bgMuted,
    },
    refLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    refRange: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WilksScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { user } = useAuth();

  const {
    history: wilksHistory,
    current: wilksCurrent,
    isLoading,
  } = useWilksProfile({ userId: user?.id });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <BackLink onPress={() => router.back()} />

        <ScreenTitle marginBottom={24}>WILKS Score</ScreenTitle>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Current score */}
            {wilksCurrent && (
              <View style={styles.currentCard}>
                <Text style={styles.currentScoreLabel}>Current Score</Text>
                <Text style={styles.currentScore}>{wilksCurrent.wilks}</Text>
                <Text style={styles.currentMeta}>
                  Bodyweight: {wilksCurrent.bodyweightKg} kg
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/settings')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bwLink}>Update bodyweight →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Current maxes table */}
            {wilksCurrent && (
              <>
                <Text style={styles.sectionHeader}>Lifts Used</Text>
                <View style={styles.card}>
                  {[
                    { lift: 'Squat', kg: wilksCurrent.squatKg },
                    { lift: 'Bench', kg: wilksCurrent.benchKg },
                    { lift: 'Deadlift', kg: wilksCurrent.deadliftKg },
                  ].map(({ lift, kg }) => (
                    <View key={lift} style={styles.liftRow}>
                      <Text style={styles.liftRowLabel}>{lift}</Text>
                      <Text style={styles.liftRowValue}>
                        {kg.toFixed(1)} kg est. 1RM
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Per-cycle history */}
            {(wilksHistory?.length ?? 0) > 0 && (
              <>
                <Text style={styles.sectionHeader}>Cycle History</Text>
                <View style={styles.card}>
                  {wilksHistory!.map((point) => (
                    <View key={point.cycleNumber} style={styles.historyRow}>
                      <Text style={styles.historyLabel}>
                        Cycle {point.cycleNumber}
                      </Text>
                      <Text style={styles.historyDate}>
                        {formatDate(point.date)}
                      </Text>
                      <Text style={styles.historyScore}>
                        {point.wilksScore}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Reference context */}
            <Text style={styles.sectionHeader}>Reference</Text>
            <View style={styles.card}>
              {WILKS_CONTEXT.map(({ label, range }) => (
                <View key={label} style={styles.refRow}>
                  <Text style={styles.refLabel}>{label}</Text>
                  <Text style={styles.refRange}>{range}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
