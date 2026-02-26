import { createClient } from '@supabase/supabase-js';
import { AppState, NativeModules, Platform } from 'react-native';

import type { Database } from './database';
import storage from '../lib/storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseUrlAndroid = process.env.EXPO_PUBLIC_SUPABASE_URL_ANDROID;
const supabaseUrlIos = process.env.EXPO_PUBLIC_SUPABASE_URL_IOS;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

function isPrivateIpv4(host: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const [a, b] = host.split('.').map(Number);
  if ([a, b].some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function resolveSupabaseUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (!isLoopback || Platform.OS === 'web') return rawUrl;

    const scriptUrl = NativeModules?.SourceCode?.scriptURL as string | undefined;
    const metroHost = scriptUrl ? new URL(scriptUrl).hostname : undefined;
    if (metroHost && isPrivateIpv4(metroHost) && metroHost !== '127.0.0.1') {
      url.hostname = metroHost;
      return url.toString();
    }

    // Android emulator cannot reach host machine via localhost.
    if (Platform.OS === 'android') {
      url.hostname = '10.0.2.2';
      return url.toString();
    }
  } catch {
    // Fall through to the original URL if parsing fails.
  }

  return rawUrl;
}

const platformOverrideUrl =
  Platform.OS === 'android'
    ? supabaseUrlAndroid
    : Platform.OS === 'ios'
      ? supabaseUrlIos
      : undefined;

const resolvedSupabaseUrl = platformOverrideUrl
  ? platformOverrideUrl
  : resolveSupabaseUrl(supabaseUrl);

if (__DEV__) {
  // Helpful for diagnosing local networking issues on emulators/devices.
  console.log('[supabase] URL:', resolvedSupabaseUrl);
}

export const typedSupabase = createClient<Database>(resolvedSupabaseUrl, supabaseAnonKey, {
  auth: {
    ...(storage ? { storage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Keep the free-tier Supabase DB from pausing (pings if > 5 days since last ping).
const LAST_PING_KEY = 'supabase_last_ping';
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

async function keepalive() {
  try {
    const raw = storage ? await storage.getItem(LAST_PING_KEY) : null;
    const lastPing = raw ? parseInt(raw, 10) : 0;
    if (Date.now() - lastPing > FIVE_DAYS_MS) {
      await typedSupabase.from('profiles').select('id').limit(1);
      if (storage) await storage.setItem(LAST_PING_KEY, String(Date.now()));
    }
  } catch {
    // Non-critical — ignore keepalive errors silently
  }
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    keepalive();
  }
});
