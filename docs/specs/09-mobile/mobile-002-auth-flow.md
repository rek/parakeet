# Spec: Mobile Auth Flow

**Status**: Planned
**Domain**: Mobile App

## What This Covers

Firebase Authentication integration in the mobile app: sign-in, token storage, token refresh, and sign-out.

## Tasks

**Packages to install:**
- `@react-native-firebase/app`
- `expo-auth-session` (for Google OAuth)
- `expo-crypto` (for PKCE)
- `expo-apple-authentication` (for Apple Sign-In, iOS only)
- `expo-secure-store` (token storage)

**`apps/mobile/app/(auth)/welcome.tsx`:**
- "Sign in with Google" button: triggers `promptAsync()` from `useAuthRequest()` (expo-auth-session)
  - On success: exchange code for Firebase credential, `signInWithCredential(auth, credential)`
  - On Firebase sign-in success: Firebase auth state listener triggers redirect to onboarding/today
- "Sign in with Apple" button (iOS only, hidden on Android):
  - `AppleAuthentication.signInAsync()` → get credential → Firebase credential exchange
- Show loading state during sign-in

**`apps/mobile/services/auth.ts`:**
- `getToken(): Promise<string>` — returns current Firebase ID token (auto-refreshed by Firebase SDK)
- `signOut(): Promise<void>` — Firebase signOut + clear SecureStore + navigate to welcome
- `getCurrentUser(): FirebaseUser | null`

**Token injection in API client:**
- The `api-client` package calls `getToken()` before every request and sets `Authorization: Bearer <token>`
- If token fetch fails → sign out and redirect to welcome

**`apps/mobile/hooks/useAuth.ts`:**
- Wraps Firebase `onAuthStateChanged` listener
- Exposes `{ user, loading, signOut }` to components

## Dependencies

- [mobile-001-expo-router-layout.md](./mobile-001-expo-router-layout.md)
- [auth-001-supabase-auth-setup.md](../02-auth/auth-001-supabase-auth-setup.md)
