import 'expo/fetch';
import { useEffect } from 'react';
import { View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@modules/auth';
import { useMissedSessionReconciliation, useSyncQueue } from '@modules/session';
import { queryClient } from '@platform/query';
import '@platform/supabase/bootstrap';
import { ReturnToSessionBanner } from '../components/session/ReturnToSessionBanner';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

Sentry.init({
  dsn: 'https://c482059524039032385f5b63dcc3900d@o4510964260864000.ingest.de.sentry.io/4510964263616592',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { loading } = useAuth();
  const insets = useSafeAreaInsets();
  useSyncQueue();
  useMissedSessionReconciliation();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="disruption-report" />
        <Stack.Screen name="formula" options={{ presentation: 'modal' }} />
      </Stack>
      {/* 
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 0,
          right: 0,
        }}
        pointerEvents="box-none"
      >
        <ReturnToSessionBanner />
      </View> 
      */}
    </View>
  );
}

function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RootLayoutNav />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
