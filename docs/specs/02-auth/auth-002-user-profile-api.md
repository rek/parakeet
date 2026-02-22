# Spec: User Profile (Supabase Direct)

**Status**: Planned
**Domain**: Auth & Users

## What This Covers

User profile management using Supabase SDK directly from the mobile app. No custom API server.

## Tasks

**`apps/mobile/lib/profile.ts` (helper functions):**

```typescript
// Get current user profile
async function getProfile(): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, created_at')
    .eq('id', (await supabase.auth.getUser()).data.user!.id)
    .single()
  return data
}

// Update display name
async function updateProfile(update: { display_name?: string }): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user!.id
  await supabase.from('profiles').update(update).eq('id', userId)
}
```

**Settings screen:**
- Display: email (from `supabase.auth.getUser()`), display_name (from `profiles`)
- Edit: display_name field with save button → calls `updateProfile()`
- Sign out button → calls `supabase.auth.signOut()`
- Delete account: triggers `supabase.auth.admin.deleteUser()` — note: this requires a Supabase Edge Function since the admin API can't be called from client. For a personal 2-user app, manual deletion via Supabase dashboard is acceptable.

**RLS handles all access control automatically** — no need for server-side user ID validation. The `auth.uid()` in RLS policies ensures each user only accesses their own data.

## Dependencies

- [auth-001-supabase-auth-setup.md](./auth-001-supabase-auth-setup.md)
