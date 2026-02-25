# Spec: Supabase Auth Setup

**Status**: Implemented
**Domain**: Auth & Users

## What This Covers

Supabase Authentication integration in the parakeet app. Replaces Firebase Auth entirely. Handles sign-in, session persistence, token refresh, and sign-out.

## Tasks

**Packages to install:**
- [x] Install auth packages:
  ```bash
  npm install @supabase/supabase-js @react-native-async-storage/async-storage
  npm install @react-native-google-signin/google-signin  # Google Sign-In
  ```

**`apps/parakeet/lib/supabase.ts` (Supabase client singleton):**
- [x] Create Supabase client with AsyncStorage session persistence:
  ```typescript
  import { createClient } from '@supabase/supabase-js';
  import AsyncStorage from '@react-native-async-storage/async-storage';

  export const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    },
  );
  ```

**`apps/parakeet/hooks/useAuth.ts`:**
- [x] Subscribe to `supabase.auth.onAuthStateChange` listener
- [x] Expose `{ user, session, loading, signOut }`
- [x] On `SIGNED_IN`: if first time (no `profiles` row), create profile row and navigate to onboarding
- [x] On `SIGNED_OUT`: navigate to `/(auth)/welcome`

**`apps/parakeet/app/(auth)/welcome.tsx` — sign-in methods:**
- [x] Google Sign-In flow:
  ```typescript
  const { data, error } = await GoogleSignin.signIn();
  const { idToken } = data;
  await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  ```
- [x] Email sign-in (dev/testing):
  ```typescript
  await supabase.auth.signInWithOtp({ email })  // magic link
  ```

**Sign-out:**
- [x] Implement `supabase.auth.signOut()` (onAuthStateChange listener handles navigation)

**Profile creation (first login):**
- [x] On `SIGNED_IN` event, check if `profiles` row exists; if not, insert and route to onboarding:
  ```typescript
  const { data } = await supabase.from('profiles').select('id').eq('id', user.id).single();
  if (!data) {
    await supabase
      .from('profiles')
      .insert({ id: user.id, display_name: user.user_metadata.full_name });
    router.replace('/(auth)/onboarding/lift-maxes');
  } else {
    router.replace('/(tabs)/today');
  }
  ```

**Supabase RLS profile policy:**
- [x] Apply RLS to profiles table:
  ```sql
  CREATE POLICY "users_own_profile" ON profiles
    FOR ALL USING (auth.uid() = id);
  ```

## Dependencies

- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
- [infra-001-nx-monorepo-setup.md](../01-infra/infra-001-nx-monorepo-setup.md)
