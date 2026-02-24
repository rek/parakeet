# ADR-007: Vercel AI SDK for LLM Integration

**Date**: 2026-02-23
**Status**: Accepted

## Context

Two design docs fully specify an LLM integration layer:

- **`training-engine-architecture.md`** defines a pluggable `JITGeneratorStrategy` interface with three implementations: `FormulaJITGenerator` (v1), `LLMJITGenerator` (v1.5), and `HybridJITGenerator` (v2). The LLM strategy receives the full ~43-variable `JITInput` as structured JSON and returns a typed `JITAdjustment` struct (intensity modifier, set modifier, aux overrides, rationale).
- **`cycle-review-and-insights.md`** specifies an end-of-cycle LLM analysis: a structured `CycleReport` is sent to an LLM; a typed `CycleReview` (lift progress, aux insights, volume insights, formula suggestions, next cycle recommendations) is returned.

Both use cases share the same pattern: structured JSON in → typed structured JSON out. Neither requires a chat UI; both are background generation tasks.

The core design goal: **the system should improve over time as external AI models improve**, without requiring code changes. This rules out any approach that locks the app to models bundled at compile time.

## Decision

Use the **Vercel AI SDK** (`ai` core package + `@ai-sdk/anthropic` provider) called directly from the Expo app.

- `generateObject()` with Zod schema validation for both JIT adjustment and cycle review
- `claude-haiku-4-5` for JIT (fast, cheap, structured output, 5-second timeout)
- `claude-sonnet-4-6` for cycle review (deeper reasoning, async — user waits for notification)
- API key via `EXPO_PUBLIC_ANTHROPIC_API_KEY` (EAS Secrets for builds)
- `import 'expo/fetch'` polyfill at app entry for Vercel AI SDK fetch compatibility

## Rationale

### Pros

- `generateObject()` handles streaming, retries, Zod validation, and parse error recovery in one call — writing this manually would be significant boilerplate
- Swapping Claude Haiku → Sonnet → GPT-4o → future models is a one-constant change; no architectural refactoring needed — directly satisfies the "improves as models improve" goal
- Official Expo 52+ support documented in Vercel AI SDK; Expo 54 (this project) is supported
- `ai` core package has no browser dependencies — works in any JS runtime including React Native
- Two users → trivial API cost (~$2–5/month at most)
- Zod output validation catches LLM hallucinations at parse time; hard constraint layer in engine catches anything that slips through

### Cons

- API key shipped in app bundle (mitigated: personal app with 2 trusted users; EAS Secrets for builds)
- Requires network for LLM features; `LLMJITGenerator` must fall back to `FormulaJITGenerator` on timeout

## Alternatives Considered

### `@react-native-ai` (Callstack — on-device inference)

- Runs Apple Foundation Models (iOS 18+) or downloaded GGUF/MLC models on-device
- Full privacy, offline, zero cost
- **Why not chosen:** The entire point of LLM integration is that models improve over time. On-device models are frozen at deployment. Cannot access GPT-4.5, Claude Sonnet 4.5+, or any future frontier model without shipping an app update. Defeats the stated architectural goal.

### `@ai-sdk/react` (Vercel AI SDK React hooks)

- Provides `useChat`, `useCompletion`, `useObject` hooks
- **Why not chosen:** These are web-only React hooks with browser dependencies. The project has no chat UI. `generateObject()` from the `ai` core package is the correct layer for background structured generation.

### Direct `fetch` to Anthropic API

- Viable and simple for a 2-user app
- **Why not chosen:** `generateObject()` provides Zod schema validation, automatic retry on parse error, streaming support, and multi-provider compatibility for free. Reimplementing this is unnecessary.

### Supabase Edge Functions as proxy

- API key stays server-side; no bundle exposure
- **Why not chosen:** Adds latency (extra hop) and operational overhead. Training engine already runs on-device; LLM calls from on-device is architecturally consistent. Acceptable for 2 users.

## Consequences

### Positive

- `LLMJITGenerator` and cycle review use identical SDK patterns — one learning curve
- Provider switch (Anthropic → OpenAI → Google) is a one-line change if needed
- Output is always a validated TypeScript type (no `any` anywhere in the AI layer)
- Hard constraint layer in engine (`MRV cap`, `weight floor >= 40%`, `minimum 1 set`) provides a safety net regardless of LLM output

### Negative

- LLM features require network; formula fallback must always be available
- API key in bundle is visible to anyone who extracts the app (acceptable for personal use)

### Neutral

- `EXPO_PUBLIC_ANTHROPIC_API_KEY` follows Expo's public env var convention; works with EAS Secrets for production builds

## Implementation Notes

```bash
npm install ai @ai-sdk/anthropic
```

App entry polyfill (`apps/parakeet/app/_layout.tsx`, first import):
```typescript
import 'expo/fetch'
```

Model constants (`packages/training-engine/src/ai/models.ts`):
```typescript
import { anthropic } from '@ai-sdk/anthropic'

export const JIT_MODEL = anthropic('claude-haiku-4-5')
export const CYCLE_REVIEW_MODEL = anthropic('claude-sonnet-4-6')
```

JIT call pattern:
```typescript
const { object } = await generateObject({
  model: JIT_MODEL,
  schema: JITAdjustmentSchema,
  system: JIT_SYSTEM_PROMPT,
  prompt: JSON.stringify(jitInput),
  abortSignal: AbortSignal.timeout(5000),
})
```

See `docs/specs/10-ai/ai-001-vercel-ai-sdk-setup.md` for full setup spec.

## References

- [Vercel AI SDK — Getting Started with Expo](https://ai-sdk.dev/docs/getting-started/expo)
- [Vercel AI SDK — generateObject](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object)
- [Callstack react-native-ai (rejected)](https://github.com/callstackincubator/ai)
- ADR-006: Supabase over GCP
- `docs/design/training-engine-architecture.md`
- `docs/design/cycle-review-and-insights.md`
