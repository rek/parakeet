import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { WorkoutCard } from '../../components/training/WorkoutCard'
import { useAuth } from '../../hooks/useAuth'
import { useActiveProgram } from '../../hooks/useActiveProgram'
import { useTodaySession } from '../../hooks/useTodaySession'
import { getActiveDisruptions } from '../../lib/disruptions'

export default function TodayScreen() {
  const { user } = useAuth()
  const { data: session, isLoading: sessionLoading } = useTodaySession()
  const { data: program, isLoading: programLoading } = useActiveProgram()
  const queryClient = useQueryClient()

  const { data: disruptions } = useQuery({
    queryKey: ['disruptions', 'active', user?.id],
    queryFn: () => getActiveDisruptions(user!.id),
    enabled: !!user?.id,
  })

  if (sessionLoading || programLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Parakeet</Text>
      </View>

      <View style={styles.content}>
        {!program ? (
          // No program state
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Welcome to Parakeet</Text>
            <Text style={styles.emptySubtitle}>
              Create a program to get started.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/(auth)/onboarding/lift-maxes')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Create Program</Text>
            </TouchableOpacity>
          </View>
        ) : session ? (
          // Session found — show workout card
          <WorkoutCard
            session={session}
            activeDisruptions={disruptions ?? []}
            onSkipComplete={() =>
              queryClient.invalidateQueries({ queryKey: ['session', 'today'] })
            }
          />
        ) : (
          // Program exists but no session today — rest day
          <View style={styles.restDayCard}>
            <Text style={styles.restDayTitle}>Rest Day</Text>
            <Text style={styles.restDaySubtitle}>
              Keep recovering — next session coming up soon.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  // No program / empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Rest day card
  restDayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 28,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  restDayTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  restDaySubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
})
