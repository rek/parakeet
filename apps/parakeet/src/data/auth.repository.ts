import type {
  AuthChangeEvent,
  Session,
  Subscription,
  User,
} from '@supabase/supabase-js';

import { typedSupabase } from '../network/supabase-client';

export async function getCurrentSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await typedSupabase.auth.getSession();
  return session;
}

export function subscribeToAuthStateChanges(
  listener: (event: AuthChangeEvent, session: Session | null) => void | Promise<void>,
): Subscription {
  const {
    data: { subscription },
  } = typedSupabase.auth.onAuthStateChange(listener);

  return subscription;
}

export async function signInWithGoogleIdToken(token: string): Promise<void> {
  const { error } = await typedSupabase.auth.signInWithIdToken({
    provider: 'google',
    token,
  });

  if (error) throw error;
}

export async function signInWithOtpEmail(
  email: string,
  emailRedirectTo: string,
): Promise<void> {
  const { error } = await typedSupabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  });

  if (error) throw error;
}

export async function signOutCurrentUser(): Promise<void> {
  const { error } = await typedSupabase.auth.signOut();
  if (error) throw error;
}

export async function findProfileId(userId: string): Promise<string | null> {
  const { data, error } = await typedSupabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function insertInitialProfile(user: User): Promise<void> {
  const { error } = await typedSupabase.from('profiles').insert({
    id: user.id,
    display_name: user.user_metadata?.['full_name'] ?? null,
  });

  if (error) throw error;
}
