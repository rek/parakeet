import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  ensureSignedInUserProfile,
  getInitialAuthSession,
  onAuthStateChanged,
  signOut as signOutUser,
} from '../services/auth.service';

import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInitialAuthSession().then((s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const subscription = onAuthStateChanged(async (_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);

      if (_event === 'SIGNED_IN' && s?.user) {
        try {
          const profileStatus = await ensureSignedInUserProfile(s.user);
          if (profileStatus === 'profile_created') {
            router.replace('/(auth)/onboarding/lift-maxes');
          } else {
            router.replace('/(tabs)/today');
          }
        } catch (error) {
          console.error('[auth] SIGNED_IN bootstrap failed:', error);
          router.replace('/(tabs)/today');
        }
      } else if (_event === 'SIGNED_OUT') {
        router.replace('/(auth)/welcome');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await signOutUser();
  }

  return { user, session, loading, signOut };
}
