import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { AchievementsSection, useAchievementsData } from '@modules/achievements';
import { useAuth } from '@modules/auth';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackLink } from '../../components/navigation/BackLink';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

// ── Screen ────────────────────────────────────────────────────────────────────

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
    screenTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
  });
}

export default function AchievementsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { user } = useAuth();

  const { badges, streak, prs, funBadges, isLoading } = useAchievementsData(
    user?.id
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <BackLink label="Settings" onPress={() => router.back()} />

        <Text style={styles.screenTitle}>Achievements</Text>

        <AchievementsSection
          badges={badges}
          streak={streak}
          prs={prs}
          funBadges={funBadges}
          isLoading={isLoading}
          onBadgePress={(programId) =>
            router.push(`/history/cycle-review/${programId}`)
          }
          onWilksPress={() => router.push('/profile/wilks')}
          onPRPress={(sessionId) => router.push(`/history/${sessionId}`)}
          onFunBadgePress={(sessionId) => router.push(`/history/${sessionId}`)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
