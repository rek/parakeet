# Spec: OpenAI Edge Function Proxy

**Status**: Done

**Domain**: Infra

**Issue**: GH#161

## What This Covers

Move the OpenAI API key from the client JS bundle (`EXPO_PUBLIC_OPENAI_API_KEY`) to a server-side Supabase Edge Function. The client sends AI requests authenticated via Supabase JWT; the Edge Function validates the JWT, applies rate limiting, and forwards to OpenAI with the real key.

This is a HIGH-severity security fix — the current `EXPO_PUBLIC_` key is extractable from any APK.

## Architecture

```
Client (generateText)
  → custom fetch (injects JWT, rewrites URL)
  → Supabase Edge Function (ai-proxy)
    → validates JWT via Supabase auth
    → rate-limits per user_id
    → forwards to api.openai.com with real OPENAI_API_KEY
  ← returns OpenAI response transparently
```

The Edge Function is an **OpenAI-compatible transparent proxy** — the AI SDK thinks it's talking to OpenAI. This means zero changes to `generateText`/`generateObject` call sites.

## Tasks

### Phase 1 — Edge Function

**`supabase/functions/ai-proxy/index.ts`:**

- [x] Deno-based Edge Function that proxies requests to `api.openai.com`
  - Reads `OPENAI_API_KEY` from `Deno.env` (server-side secret, never shipped to client)
  - Validates Supabase JWT from `Authorization` header (using `@supabase/supabase-js` `createClient` + `auth.getUser()`)
  - Extracts `user_id` from JWT for rate limiting
  - Rewrites request URL: `/functions/v1/ai-proxy/v1/chat/completions` → `https://api.openai.com/v1/chat/completions`
  - Sets `Authorization: Bearer <OPENAI_API_KEY>` on forwarded request
  - Returns OpenAI response with original status code and headers
  - CORS headers for web dev
- [x] Rate limiting: simple per-user counter (max 100 requests/hour)
  - Uses Supabase table `ai_rate_limits` (`user_id`, `request_count`, `window_start`)
  - Returns 429 if limit exceeded
- [x] Error handling: returns structured JSON errors, never leaks the real API key

### Phase 2 — Training-engine model refactor

**`packages/training-engine/src/ai/models.ts`:**

- [x] Add `configureAIProxy({ proxyBaseURL, authTokenProvider })` export
  - `proxyBaseURL`: Edge Function URL (e.g., `https://<project>.supabase.co/functions/v1/ai-proxy`)
  - `authTokenProvider`: `() => Promise<string>` that returns current Supabase JWT
- [x] Change `JIT_MODEL` and `CYCLE_REVIEW_MODEL` from const exports to lazy getter functions: `getJITModel()`, `getCycleReviewModel()`
  - Uses `createOpenAI` with custom `fetch` that injects JWT via `authTokenProvider`
  - Falls back to direct OpenAI (via env var) when proxy not configured (dev/test)
- [x] Export `configureAIProxy`, `getJITModel`, `getCycleReviewModel` from package index

**Update all AI call sites (7 files):**

- [x] `packages/training-engine/src/generator/llm-jit-generator.ts`: `JIT_MODEL` → `getJITModel()`
- [x] `packages/training-engine/src/review/calibration-reviewer.ts`: `JIT_MODEL` → `getJITModel()`
- [x] `packages/training-engine/src/review/judge-reviewer.ts`: `JIT_MODEL` → `getJITModel()`
- [x] `packages/training-engine/src/review/decision-replay.ts`: `JIT_MODEL` → `getJITModel()`
- [x] `packages/training-engine/src/review/form-coaching-generator.ts`: `CYCLE_REVIEW_MODEL` → `getCycleReviewModel()`
- [x] `packages/training-engine/src/review/cycle-review-generator.ts`: `CYCLE_REVIEW_MODEL` → `getCycleReviewModel()`
- [x] `apps/parakeet/src/modules/session/application/motivational-message.service.ts`: `JIT_MODEL` → `getJITModel()`

### Phase 3 — App bootstrap wiring

**`apps/parakeet/src/platform/supabase/bootstrap.ts`:**

- [x] Call `configureAIProxy()` during app initialization
  - `proxyBaseURL` from `EXPO_PUBLIC_SUPABASE_URL` + `/functions/v1/ai-proxy`
  - `authTokenProvider` reads current session via `typedSupabase.auth.getSession()`

### Phase 4 — Migration + env cleanup

- [x] Create migration: `ai_rate_limits` table with RLS
- [x] Add `OPENAI_API_KEY` to Supabase Edge Function secrets (via `supabase secrets set`)
- [x] Remove `EXPO_PUBLIC_OPENAI_API_KEY` from `.env` files (keep for local dev fallback)

## Dependencies

- Supabase Edge Functions runtime (Deno)
- `@ai-sdk/openai` custom `fetch` support (confirmed in both v1 and v3)
- ADR-009 acknowledges the current key exposure
