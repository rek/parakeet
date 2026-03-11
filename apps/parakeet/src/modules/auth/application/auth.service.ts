import * as Sentry from '@sentry/react-native';
import type {
  AuthChangeEvent,
  Session,
  Subscription,
  User,
} from '@supabase/supabase-js';

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
  listener: (
    event: AuthChangeEvent,
    session: Session | null
  ) => void | Promise<void>
): Subscription {
  return subscribeToAuthStateChanges(listener);
}

export async function ensureSignedInUserProfile(
  user: User
): Promise<OnSignedInResult> {
  const existingProfileId = await findProfileId(user.id);
  if (existingProfileId) return 'existing_profile';

  try {
    await insertInitialProfile(user);
    return 'profile_created';
  } catch (error) {
    Sentry.captureException(error);
    return 'existing_profile';
  }
}

export async function signInWithGoogleToken(idToken: string): Promise<void> {
  await signInWithGoogleIdToken(idToken);
}

export async function signInWithMagicLink(
  email: string,
  emailRedirectTo: string
): Promise<void> {
  await signInWithOtpEmail(email, emailRedirectTo);
}

export async function signOut(): Promise<void> {
  await signOutCurrentUser();
}
