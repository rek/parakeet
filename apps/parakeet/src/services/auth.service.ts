import type { AuthChangeEvent, Session, Subscription, User } from '@supabase/supabase-js';

import {
  findProfileId,
  getCurrentSession,
  insertInitialProfile,
  signInWithGoogleIdToken,
  signInWithOtpEmail,
  signOutCurrentUser,
  subscribeToAuthStateChanges,
} from '../data/auth.repository';

export type OnSignedInResult = 'profile_created' | 'existing_profile';

export async function getInitialAuthSession(): Promise<Session | null> {
  return getCurrentSession();
}

export function onAuthStateChanged(
  listener: (event: AuthChangeEvent, session: Session | null) => void | Promise<void>,
): Subscription {
  return subscribeToAuthStateChanges(listener);
}

export async function ensureSignedInUserProfile(user: User): Promise<OnSignedInResult> {
  try {
    const existingProfileId = await findProfileId(user.id);
    if (existingProfileId) return 'existing_profile';
  } catch (error) {
    // Auth callback can race with session persistence; continue with best effort.
    console.warn('[auth] profile lookup failed during SIGNED_IN:', error);
  }

  try {
    await insertInitialProfile(user);
    return 'profile_created';
  } catch (error) {
    // If profile creation fails (e.g. already exists/race), continue as existing user.
    console.warn('[auth] profile bootstrap failed during SIGNED_IN:', error);
    return 'existing_profile';
  }
}

export async function signInWithGoogleToken(idToken: string): Promise<void> {
  await signInWithGoogleIdToken(idToken);
}

export async function signInWithMagicLink(email: string, emailRedirectTo: string): Promise<void> {
  await signInWithOtpEmail(email, emailRedirectTo);
}

export async function signOut(): Promise<void> {
  await signOutCurrentUser();
}
