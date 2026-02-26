import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'

import { useAuth } from '../../hooks/useAuth'
import { AchievementsSection } from '../../components/achievements/AchievementsSection'
import { colors } from '../../theme'
import { BackLink } from '../../components/navigation/BackLink'

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AchievementsScreen() {
  const { user } = useAuth()

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

        {user && <AchievementsSection userId={user.id} />}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
})
