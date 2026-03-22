# ADR-009: Drop expo-secure-store, use AsyncStorage for auth session

**Date**: 2026-03-22

**Status**: Accepted

## Context

The Supabase auth session (JWT + refresh token + metadata) was stored in `expo-secure-store` (iOS Keychain / Android Keystore). The serialized session routinely exceeds SecureStore's 2048-byte per-key limit, triggering warnings and risking silent data loss in future Expo SDK versions.

A chunking adapter was implemented to split values across multiple keys, but this added complexity for questionable benefit.

## Decision

Remove `expo-secure-store` entirely. Use `AsyncStorage` (already a dependency) for the Supabase auth session. No secrets in the app require keychain-level protection.

## Rationale

- **Supabase anon key** is public by design — RLS protects data, not the key
- **JWT access tokens** are signed, short-lived, and can't be forged — reading one from storage gives temporary access that expires
- **Refresh tokens** are the only mildly sensitive piece, but an attacker with device-level access to read AsyncStorage already has the app open
- **OpenAI API key** comes from `process.env['EXPO_PUBLIC_OPENAI_API_KEY']` which is baked into the JS bundle at build time — SecureStore can't protect compile-time constants
- The chunking adapter added ~60 lines of non-trivial async code for zero practical security improvement

### Pros

- Eliminates 2048-byte limit warnings
- Removes `expo-secure-store` dependency (one fewer native module)
- Removes chunking complexity (get/set/remove × chunk management)
- AsyncStorage has no size limit and is faster for large values

### Cons

- Auth session tokens are stored in plain AsyncStorage rather than the OS keychain
- If we later need to store actual user secrets (e.g., user-provided API keys), we'd need to re-add SecureStore

## Alternatives Considered

### Alternative 1: Keep SecureStore with chunking

- Works but adds 60+ lines of code to manage a 2048-byte limit
- Protects tokens that don't need protection
- Chunking introduces potential corruption edge cases (partial writes)

### Alternative 2: Move only large values to AsyncStorage, keep SecureStore for small ones

- Over-engineered — we have no small secrets that benefit from keychain storage

## Consequences

### Positive

- Simpler codebase, one fewer dependency
- No more SecureStore size warnings

### Negative

- Users will be re-prompted to log in once (session moves from keychain to AsyncStorage storage key)

## Implementation Notes

- `platform/lib/secure-storage.ts` deleted
- `platform/supabase/supabase-client.ts` now uses `storage` (AsyncStorage) directly
- `expo-secure-store` removed from `package.json`
- If we ever add user-provided secrets (e.g., custom API keys), revisit this decision
