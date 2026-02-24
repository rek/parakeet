# Spec: parakeet Auth Flow

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

Supabase Authentication integration in the parakeet app: Google Sign-In, session persistence, and sign-out. Auth state is managed by the `useAuth` hook; the `supabase` singleton handles token refresh automatically via AsyncStorage.

## Tasks

**Packages to install:**

Already installed as part of `auth-001-supabase-auth-setup.md`:
- `@supabase/supabase-js`
- `@react-native-async-storage/async-storage`
- `@react-native-google-signin/google-signin`

No Firebase packages. No custom API client.

**`apps/parakeet/app/(auth)/welcome.tsx`:**
- "Sign in with Google" button:
  ```typescript
  const { data } = await GoogleSignin.signIn()
  await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: data.idToken,
  })
  // onAuthStateChange listener (in useAuth) handles redirect
  ```
- "Continue with email" link (dev/testing only, hidden in production):
  ```typescript
  await supabase.auth.signInWithOtp({ email })
  ```
- Show loading state during sign-in; catch errors and show inline message

**`apps/parakeet/hooks/useAuth.ts`:**
- Subscribe to `supabase.auth.onAuthStateChange` on mount, unsubscribe on unmount
- Expose `{ user, session, loading, signOut }`
- `SIGNED_IN` → check `profiles` row; if missing → navigate to `/(auth)/onboarding/lift-maxes`; else → `/(tabs)/today`
- `SIGNED_OUT` → navigate to `/(auth)/welcome`
- `signOut()` calls `supabase.auth.signOut()`

**Token management:**
- No manual token handling. Supabase SDK auto-refreshes the session via `autoRefreshToken: true`.
- No `Authorization` header management — there is no custom API client. Supabase SDK attaches the session token to all RPC and table calls automatically.

**`apps/parakeet/app/_layout.tsx` root layout integration:**
- Mount `useAuth` at root (or use `SessionContextProvider` from `@supabase/auth-helpers-react-native` if preferred)
- Show splash screen (`SplashScreen.preventAutoHideAsync()`) until `loading === false`
- Redirect guard: `user === null` → `/(auth)/welcome`; `user !== null && !hasActiveProgram` → onboarding; else → `/(tabs)/today`

## Dependencies

- [parakeet-001-expo-router-layout.md](./parakeet-001-expo-router-layout.md)
- [auth-001-supabase-auth-setup.md](../02-auth/auth-001-supabase-auth-setup.md)
