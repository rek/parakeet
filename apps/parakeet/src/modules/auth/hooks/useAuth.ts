import * as Sentry from '@sentry/react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  ensureSignedInUserProfile,
  getInitialAuthSession,
  onAuthStateChanged,
  signOut as signOutUser,
} from '../application/auth.service';

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
          Sentry.captureException(error)
          router.replace('/(tabs)/today');
        }
      } else if (_event === 'INITIAL_SESSION' && s?.user) {
        // Restore session on app launch — redirect to today and ensure profile exists
        router.replace('/(tabs)/today');
        ensureSignedInUserProfile(s.user).catch((err) => Sentry.captureException(err));
      } else if (_event === 'SIGNED_OUT' || (_event === 'TOKEN_REFRESHED' && !s)) {
        // SIGNED_OUT: explicit sign-out or token refresh failure invalidated the session.
        // TOKEN_REFRESHED with null session: refresh failed before SIGNED_OUT fires.
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
