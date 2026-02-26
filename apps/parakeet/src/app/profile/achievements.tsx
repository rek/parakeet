import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'

import { useAuth } from '../../hooks/useAuth'
import { AchievementsSection } from '../../components/achievements/AchievementsSection'

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
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>‹ Settings</Text>
        </TouchableOpacity>

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
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  backRow: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 16,
    color: '#4F46E5',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
})
