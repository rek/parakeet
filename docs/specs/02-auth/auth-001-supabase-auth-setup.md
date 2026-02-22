# Spec: Supabase Auth Setup

**Status**: Planned
**Domain**: Auth & Users

## What This Covers

Supabase Authentication integration in the mobile app. Replaces Firebase Auth entirely. Handles sign-in, session persistence, token refresh, and sign-out.

## Tasks

**Packages to install:**
```bash
npm install @supabase/supabase-js @react-native-async-storage/async-storage
npm install expo-apple-authentication  # Apple Sign-In
npm install @react-native-google-signin/google-signin  # Google Sign-In
```

**`apps/mobile/lib/supabase.ts` (Supabase client singleton):**
```typescript
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

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
  }
)
```

**`apps/mobile/hooks/useAuth.ts`:**
- Subscribe to `supabase.auth.onAuthStateChange` listener
- Expose `{ user, session, loading, signOut }`
- On `SIGNED_IN`: if first time (no `profiles` row), create profile row and navigate to onboarding
- On `SIGNED_OUT`: navigate to `/(auth)/welcome`

**`apps/mobile/app/(auth)/welcome.tsx` — sign-in methods:**

Google Sign-In:
```typescript
const { data, error } = await GoogleSignin.signIn()
const { idToken } = data
await supabase.auth.signInWithIdToken({
  provider: 'google',
  token: idToken,
})
```

Apple Sign-In:
```typescript
const credential = await AppleAuthentication.signInAsync({
  requestedScopes: [FULL_NAME, EMAIL],
})
await supabase.auth.signInWithIdToken({
  provider: 'apple',
  token: credential.identityToken!,
})
```

Email sign-in (dev/testing):
```typescript
await supabase.auth.signInWithOtp({ email })  // magic link
```

**Sign-out:**
```typescript
await supabase.auth.signOut()
// onAuthStateChange listener handles navigation
```

**Profile creation (first login):**
On `SIGNED_IN` event, check if `profiles` row exists for `user.id`:
```typescript
const { data } = await supabase.from('profiles').select('id').eq('id', user.id).single()
if (!data) {
  await supabase.from('profiles').insert({ id: user.id, display_name: user.user_metadata.full_name })
  router.replace('/(auth)/onboarding/lift-maxes')
} else {
  router.replace('/(tabs)/today')
}
```

**Supabase RLS profile policy:**
```sql
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL USING (auth.uid() = id);
```

## Dependencies

- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
- [infra-001-nx-monorepo-setup.md](../01-infra/infra-001-nx-monorepo-setup.md)
