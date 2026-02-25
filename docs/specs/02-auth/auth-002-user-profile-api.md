# Spec: User Profile (Supabase Direct)

**Status**: Implemented
**Domain**: Auth & Users

## What This Covers

User profile management using Supabase SDK directly from the parakeet app. No custom API server.

## Tasks

**`apps/parakeet/lib/profile.ts` (helper functions):**
- [x] `getProfile(): Promise<Profile | null>` — fetch current user profile from `profiles` table
- [x] `updateProfile(update: { display_name?: string }): Promise<void>` — update display name

**Settings screen:**
- [x] Display: email (from `supabase.auth.getUser()`), display_name (from `profiles`)
- [x] Edit: display_name field with save button → calls `updateProfile()`
- [x] Sign out button → calls `supabase.auth.signOut()`
- [x] Delete account: note that this requires a Supabase Edge Function (admin API not callable from client); for a personal 2-user app, manual deletion via Supabase dashboard is acceptable

**RLS handles all access control automatically** — no need for server-side user ID validation. The `auth.uid()` in RLS policies ensures each user only accesses their own data.

## Dependencies

- [auth-001-supabase-auth-setup.md](./auth-001-supabase-auth-setup.md)
