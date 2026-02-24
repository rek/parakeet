# Spec: Vercel AI SDK Setup

**Status**: Planned
**Domain**: AI Integration

## What This Covers

Package installation, environment variable setup, `expo/fetch` polyfill, model constants, and shared prompt construction utilities for the AI layer. This is the foundation for `engine-011` (LLM JIT generator) and `engine-012` (cycle review generator).

## Tasks

### Package Installation

```bash
npm install ai @ai-sdk/anthropic
```

### Environment Variables

**`apps/parakeet/.env.local`** (development, gitignored):
```
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
```

**EAS Secrets** (production builds):
```bash
eas secret:create --scope project --name EXPO_PUBLIC_ANTHROPIC_API_KEY --value sk-ant-...
```

The `EXPO_PUBLIC_` prefix makes the key accessible in Expo's environment. For a 2-user personal app this is acceptable; the key is technically extractable from the bundle but usage is trivially auditable.

### Expo Fetch Polyfill

**`apps/parakeet/app/_layout.tsx`** — add as the **first import** before any AI SDK usage:

```typescript
import 'expo/fetch'
// ... rest of imports
```

Vercel AI SDK uses the Web Fetch API. React Native's `fetch` does not fully conform; `expo/fetch` provides the required polyfill. This must be the first import to ensure the polyfill is in place before any SDK module loads.

### Model Constants

**`packages/training-engine/src/ai/models.ts`:**

```typescript
import { createAnthropic } from '@ai-sdk/anthropic'

const anthropic = createAnthropic({
  apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
})

// Fast, cheap — used for JIT session generation (5s timeout)
export const JIT_MODEL = anthropic('claude-haiku-4-5')

// Deep reasoning — used for cycle review (async, no timeout)
export const CYCLE_REVIEW_MODEL = anthropic('claude-sonnet-4-6')
```

Swapping to a different model or provider is a one-line change. No other files need updating.

### Prompt Utilities

**`packages/training-engine/src/ai/prompts.ts`:**

```typescript
export const JIT_SYSTEM_PROMPT = `
You are an expert powerlifting coach generating a training session adjustment.

You will receive a JSON object containing the athlete's current state and today's planned session.
Return a JSON object matching the JITAdjustment schema exactly.

Rules:
- Consider ALL signals holistically. Do not penalize the same underlying cause multiple times.
- An active disruption takes precedence over soreness and RPE signals.
- intensityModifier must be between 0.40 and 1.20.
- setModifier must be between -3 and +2.
- Provide 1-4 concise rationale strings explaining your reasoning.
- If signals are mild and session should proceed normally, return intensityModifier: 1.0, setModifier: 0.
`

export const CYCLE_REVIEW_SYSTEM_PROMPT = `
You are an expert powerlifting coach reviewing a complete training cycle for a single athlete.

You will receive a structured JSON report covering the full cycle: session logs, RPE trends,
volume data per muscle group, auxiliary exercise assignments and subsequent performance,
disruptions, and (if enabled) menstrual cycle overlay.

Your analysis should:
1. Identify what drove performance gains or stagnation for each main lift.
2. Detect auxiliary exercise correlations (which exercises preceded improvement vs. no change).
3. Assess weekly volume patterns against MEV/MRV thresholds.
4. Surface concrete formula suggestions (specific parameter changes with rationale).
5. Note any structural observations that would require developer attention.
6. Provide a plain-language summary of recommendations for the next cycle.

Return a JSON object matching the CycleReview schema exactly.
`
```

### Hard Constraint Constants

**`packages/training-engine/src/ai/constraints.ts`:**

```typescript
// JITAdjustment hard bounds — enforced after any strategy runs
export const JIT_INTENSITY_MIN = 0.40
export const JIT_INTENSITY_MAX = 1.20
export const JIT_SET_DELTA_MIN = -3
export const JIT_SET_DELTA_MAX = 2
export const JIT_RATIONALE_MAX_ITEMS = 5
export const JIT_RATIONALE_MAX_CHARS = 200
```

## Dependencies

- [infra-001-nx-monorepo-setup.md](../01-infra/infra-001-nx-monorepo-setup.md)
- [docs/decisions/007-vercel-ai-sdk.md](../../decisions/007-vercel-ai-sdk.md)
