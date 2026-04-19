# Troubleshooting

Recurring issues and their fixes. Log symptom + repro + fix here when you burn time on something twice.

---

## Google Sign-In: "Sign-in failed — Internal server error"

**Symptom:** Tapping Google Sign-In on Android shows an alert titled `Sign-in failed` with body `Internal server error`. The GMS `SignInHubActivity` opens and dismisses within ~50ms. `adb logcat` shows repeated `GoogleSignatureVerifier: package info is not set correctly` and no JS-side console error.

**Seen on:** 2026-04-19 (not first occurrence).

**Root cause:** Local Supabase `auth.*` schema is stale. GoTrue container (e.g. `v2.187.0+`) expects tables like `auth.identities`, `auth.flow_state`, `auth.sso_providers`, `auth.mfa_factors`. A pre-existing DB volume from an older Supabase CLI release never ran the newer GoTrue migrations, so `signInWithIdToken` fails with `relation "identities" does not exist` and the 500 surfaces as "Internal server error" in the app alert.

**Diagnose:**

```bash
# Check recent GoTrue errors
docker logs --tail 100 supabase_auth_parakeet | grep -iE "error|500"

# Confirm which auth tables exist (should be 15+ on current gotrue)
docker exec supabase_db_parakeet psql -U postgres -c "\dt auth.*"

# Confirm latest auth migration (should be 2023+; if last is 2018-xx you have the bug)
docker exec supabase_db_parakeet psql -U postgres -c \
  "SELECT version FROM auth.schema_migrations ORDER BY version DESC LIMIT 5;"
```

**Fix:**

```bash
npx supabase stop --no-backup   # drops volumes (destroys local auth.users!)
npx supabase start              # GoTrue runs its full migration set on empty schema
npx supabase db reset           # re-applies your project migrations
```

After restart, all local devices will need to sign in again (refresh tokens invalidated).

**Prevent regression:** when bumping the Supabase CLI or pulling a new `supabase/supabase-js` SDK version, re-run `supabase stop --no-backup && supabase start` so GoTrue migrations stay aligned with the running image.
