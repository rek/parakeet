import 'expo/fetch'
import { Component, useEffect, type ReactNode } from 'react'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { ScrollView, Text, View } from 'react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../lib/query-client'
import { useAuth } from '../hooks/useAuth'
import { useSyncQueue } from '../hooks/useSyncQueue'
import '../lib/supabase'
import { colors } from '../theme'
import { ReturnToSessionBanner } from '../components/session/ReturnToSessionBanner'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    const { error } = this.state
    if (error) {
      return (
        <ScrollView style={{ flex: 1, padding: 24, backgroundColor: colors.bg }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.danger, marginBottom: 8 }}>
            Crash
          </Text>
          <Text style={{ fontFamily: 'monospace', fontSize: 12, color: colors.textSecondary }}>
            {(error as Error).message}{'\n\n'}{(error as Error).stack}
          </Text>
        </ScrollView>
      )
    }
    return this.props.children
  }
}

SplashScreen.preventAutoHideAsync()

function RootLayoutNav() {
  const { loading } = useAuth()
  useSyncQueue()

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync()
    }
  }, [loading])

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session" />
        <Stack.Screen name="disruption-report" />
        <Stack.Screen name="formula" options={{ presentation: 'modal' }} />
      </Stack>
      <View
        style={{ position: 'absolute', bottom: 80, left: 0, right: 0 }}
        pointerEvents="box-none"
      >
        <ReturnToSessionBanner />
      </View>
    </View>
  )
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RootLayoutNav />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
