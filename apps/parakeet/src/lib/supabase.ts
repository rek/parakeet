import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import storage from './storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
      await supabase.from('profiles').select('id').limit(1);
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
