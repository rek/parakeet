import { Stack } from 'expo-router';
import { useEffect } from 'react';

import '../lib/supabase'; // initialise client + keepalive side-effect

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
