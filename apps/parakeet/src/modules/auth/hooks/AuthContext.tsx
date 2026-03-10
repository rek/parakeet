import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react-native';
import { router } from 'expo-router';

import {
  ensureSignedInUserProfile,
  getInitialAuthSession,
  onAuthStateChanged,
  signOut as signOutUser,
} from '../application/auth.service';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
          Sentry.captureException(error);
          router.replace('/(tabs)/today');
        }
      } else if (_event === 'INITIAL_SESSION' && s?.user) {
        router.replace('/(tabs)/today');
        ensureSignedInUserProfile(s.user).catch((err) => Sentry.captureException(err));
      } else if (_event === 'SIGNED_OUT' || (_event === 'TOKEN_REFRESHED' && !s)) {
        router.replace('/(auth)/welcome');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await signOutUser();
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
