import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Keep the free-tier Supabase DB from pausing (pings if > 5 days since last ping).
const LAST_PING_KEY = 'supabase_last_ping';
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

async function keepalive() {
  try {
    const raw = await AsyncStorage.getItem(LAST_PING_KEY);
    const lastPing = raw ? parseInt(raw, 10) : 0;
    if (Date.now() - lastPing > FIVE_DAYS_MS) {
      await supabase.from('profiles').select('id').limit(1);
      await AsyncStorage.setItem(LAST_PING_KEY, String(Date.now()));
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
