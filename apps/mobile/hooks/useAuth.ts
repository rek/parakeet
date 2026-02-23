import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

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
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);

      if (_event === 'SIGNED_IN' && s?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', s.user.id)
          .single();
        if (!data) {
          await supabase.from('profiles').insert({
            id: s.user.id,
            display_name: s.user.user_metadata?.['full_name'] ?? null,
          });
          router.replace('/(auth)/onboarding/lift-maxes');
        } else {
          router.replace('/(tabs)/today');
        }
      } else if (_event === 'SIGNED_OUT') {
        router.replace('/(auth)/welcome');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { user, session, loading, signOut };
}
