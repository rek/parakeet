# Spec: Expo Router Layout and Navigation Structure

**Status**: Planned
**Domain**: Mobile App

## What This Covers

Root layout, auth guard, tab navigator, and screen registration for the full app navigation tree.

## Tasks

**`apps/mobile/app/_layout.tsx` (root layout):**
- Load fonts (if custom fonts used)
- Initialize Firebase Auth listener
- Show splash screen while auth state loads
- Redirect: if `user === null` → `/(auth)/welcome`; if `user !== null` → `/(tabs)/today`
- Wrap all children in theme provider and query client provider (React Query)

**`apps/mobile/app/(auth)/_layout.tsx`:**
- Stack navigator for auth flow (welcome → onboarding screens)
- No back button on welcome screen

**`apps/mobile/app/(tabs)/_layout.tsx`:**
- Bottom tab navigator with 4 tabs:
  - Today (home icon)
  - Program (calendar icon)
  - History (chart icon)
  - Settings (gear icon)
- Tab bar visible only in (tabs) group; hidden during session logging and onboarding

**`apps/mobile/app/session/_layout.tsx`:**
- Stack navigator, no tab bar, custom back button
- Swipe-to-dismiss disabled (prevent accidental session abandonment)

**`apps/mobile/app/formula/_layout.tsx`:**
- Modal stack (slides up from bottom)

**Navigation type declarations (`apps/mobile/types/navigation.ts`):**
- Export typed Expo Router path params for all screens with params
- e.g., `type SessionParams = { sessionId: string }`

**Deep link registration (`apps/mobile/app.config.ts`):**
- Register URL scheme `parakeet://` for future deep linking support
- Register associated domains for Universal Links (iOS) and App Links (Android)

## Dependencies

- [infra-001-nx-monorepo-setup.md](./infra-001-nx-monorepo-setup.md)
- [auth-001-firebase-auth-setup.md](./auth-001-firebase-auth-setup.md)
