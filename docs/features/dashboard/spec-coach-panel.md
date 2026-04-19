# Spec: Dashboard Coach Panel

**Status:** Implemented (2026-04-19)
**Design:** [design-coach-panel.md](./design-coach-panel.md)
**Depends on:** Existing Video Overlay page, `@parakeet/training-engine`, `@modules/video-analysis/application/assemble-coaching-context`

## Implementation notes (2026-04-19)

**Engine signature extension (P1).** `generateFormCoaching` today hardcoded `FORM_COACHING_SYSTEM_PROMPT` + `getCycleReviewModel()`. Extended the signature to accept optional `systemPrompt` and `model` overrides so the dashboard can iterate the prompt and A/B models without forking the pipeline. Mobile callers unchanged (defaults preserve behavior).

**Dashboard ai-sdk isolation.** Engine owns `@ai-sdk/openai` (v3); mobile app has v1. To prevent the dashboard from hoisting the wrong version, added `createDirectOpenAIModel({ apiKey, modelId })` inside the engine. Dashboard never imports `@ai-sdk/openai` — only the engine does.

**Exports.** `FORM_COACHING_SYSTEM_PROMPT` + `createDirectOpenAIModel` now re-exported from `@parakeet/training-engine`.

**Cache storage.** `dashboard.coaching.<fixtureId>` / `dashboard.coaching.context.<fixtureId>` in localStorage. Error entries are stored but excluded from cache-hit lookup.

## What this covers

Wire the LLM coaching pipeline into `apps/dashboard/src/app/VideoOverlayPreview.tsx` so we can iterate the prompt + render against fixtures. Reuses engine functions verbatim. Caches responses per fixture in localStorage. No DB writes.

Non-goals: multi-fixture batch eval, diff view between two responses, persisting responses back to `session_videos`.

## Phase 1 — Transport + minimal panel

### 1.1 Configuration

- [ ] Add `VITE_OPENAI_KEY` to `apps/dashboard/.env.example` (create file if absent) with comment explaining admin-only use.
- [ ] Update `apps/dashboard/README.md` (or root README section for dashboard) — call out: dashboard never deployed, OpenAI key admin-only, do not commit `.env.local`.

### 1.2 Coaching runner module

- [ ] New file: `apps/dashboard/src/lib/coaching-runner.ts`.
- [ ] Exports `runCoaching({ context, model, systemPromptOverride? })`:
  - Configures `@ai-sdk/openai` with `VITE_OPENAI_KEY` (caller error if missing).
  - Calls `generateFormCoaching` from `@parakeet/training-engine` with the engine's signature, passing the override prompt when provided.
  - Returns `{ result: FormCoachingResult, request, latencyMs, tokensIn, tokensOut, model }`.
  - Surfaces structured errors: `MissingKeyError`, `RateLimitError`, `AuthError`, `InvalidJsonError` (with raw model output), `ScheduleError`.
- [ ] Re-exports `assembleCoachingContext` and the `FormCoachingContext` type for the page.
- [ ] No tests — pure transport wrapper. Errors are exercised manually during iteration.

### 1.3 Cache module

- [ ] New file: `apps/dashboard/src/lib/coaching-cache.ts`.
- [ ] Stores last 10 responses per fixture id in localStorage under `dashboard.coaching.<fixtureId>`.
- [ ] Each entry: `{ id, timestamp, requestHash, request: { context, prompt, model }, response, latencyMs, tokens, error? }`.
- [ ] `requestHash` is a SHA-1 of the canonical JSON of `{ context, prompt, model }`. Used to dedupe identical requests.
- [ ] API: `getHistory(fixtureId)`, `appendEntry(fixtureId, entry)`, `findCached(fixtureId, hash)`, `clearHistory(fixtureId)`.
- [ ] Tests (Vitest, jsdom env): hash determinism, entry capping at 10, cache-hit lookup.

### 1.4 Synthetic context form

- [ ] New file: `apps/dashboard/src/app/coach/CoachContextForm.tsx`.
- [ ] Fields per the design doc table.
- [ ] Defaults seeded from manifest entry's `expected` block + a small `defaultsForLift(lift)` helper for sensible plate weights / RPE.
- [ ] Persists per-fixture via the same localStorage strategy (`dashboard.coaching.context.<fixtureId>`).
- [ ] Emits `onChange(context: FormCoachingContext)` upward.

### 1.5 Coach panel container

- [ ] New file: `apps/dashboard/src/app/coach/CoachPanel.tsx`.
- [ ] Props: `fixtureId`, `analysis`, `lift`, `sagittalConfidence`, `previousAnalyses`.
- [ ] Wraps `<CoachContextForm>` + a controls row (model picker, system-prompt override toggle, generate / force-refresh button) + history list + active response renderer.
- [ ] Calls `assembleCoachingContext(...)` inside the form's onChange so the assembled context is always live.
- [ ] On Generate: hashes request → cache lookup → return cached if hit, else call `runCoaching`, append to history.
- [ ] Handles loading + error states inline.

### 1.6 Response renderer

- [ ] New file: `apps/dashboard/src/app/coach/CoachResponseCard.tsx`.
- [ ] Renders the typed `FormCoachingResult`:
  - Header strip: model · latency · cache hit/miss · token in/out · estimated cost (lookup table for known models).
  - Summary block.
  - Per-rep breakdown: rep number, form grade pill (good / acceptable / needs_work), competition verdict pill, assessment prose.
  - Cues: priority pill (high / medium / low), rep range, observation, correction.
  - Fatigue correlation, baseline comparison (each in its own collapsible block, hidden when null).
  - Competition readiness: pass/fail tally + per-criterion list.
  - Next-session suggestion.
- [ ] When the response is an error: render the request + error class + raw model output (if available).

### 1.7 Wire into VideoOverlayPreview

- [ ] Below the per-rep table block, render `<CoachPanel>` only when `analysis != null && SUPPORTED_LIFTS.includes(lift)`.
- [ ] Pass `previousAnalyses=[]` initially. Phase 2 wires the toggle.

### 1.8 Validation

- [ ] Lint clean: `nx run dashboard:lint`.
- [ ] Build clean: `vite build`.
- [ ] Manual: open Video Overlay → pick a fixture → fill form → Generate → response renders → modify cue priority threshold in the engine prompt → reload → Generate again → cache MISS, new response shows.

## Phase 2 — Longitudinal context + system-prompt override

### 2.1 Use prior fixtures as longitudinal context

- [ ] Toggle in `CoachContextForm`: "Include last N coached fixtures of same lift as longitudinal context".
- [ ] When on, `CoachPanel` walks the cache for fixtures of the same lift, takes the most recent successful response per fixture, extracts the `analysis` from the cache entry's request, passes as `previousAnalyses` to `assembleCoachingContext`.
- [ ] N picker: 3 / 5 / 10.

### 2.2 System prompt override

- [ ] Collapsible textarea in `CoachPanel` controls row. Defaults to engine `FORM_COACHING_SYSTEM_PROMPT`.
- [ ] When edited, header gets a "modified" badge.
- [ ] Override is part of the request hash → cache MISS forces a fresh call when prompt changes.
- [ ] "Reset to default" button restores the engine prompt.

### 2.3 Validation

- [ ] Same as 1.8 for the new flows.

## Phase 3 (deferred, capture as a follow-up only)

- Multi-fixture batch eval: run the same prompt across all 16 fixtures, aggregate cue priorities + verdicts.
- Diff view between two cached responses (side-by-side, JSON-aware).
- Pin engine commit per response so we can replay against historical engine versions.

## Test coverage

| File | Tests |
|---|---|
| `lib/coaching-cache.ts` | ~5 — hash determinism, append/cap, hit lookup, clear |
| `lib/coaching-runner.ts` | none (transport wrapper; manual iteration) |
| Components | none — UI iteration speed is the value, snapshot tests would slow it |

## Files touched

```
apps/dashboard/
  .env.example                                      (new — VITE_OPENAI_KEY)
  src/lib/coaching-runner.ts                        (new)
  src/lib/coaching-cache.ts                         (new)
  src/lib/__tests__/coaching-cache.test.ts          (new)
  src/app/coach/CoachPanel.tsx                      (new)
  src/app/coach/CoachContextForm.tsx                (new)
  src/app/coach/CoachResponseCard.tsx               (new)
  src/app/VideoOverlayPreview.tsx                   (edit — mount CoachPanel)

docs/features/dashboard/
  design-coach-panel.md                             (new — already exists)
  spec-coach-panel.md                               (new — this file)
  index.md                                          (new — already exists)

docs/backlog.md                                     (edit — item #20)
```

## Risks (operational)

| Risk | Mitigation |
|---|---|
| Forgotten `.env.local` commit leaks the OpenAI key | `.env.local` is in root `.gitignore`; verify with `git check-ignore` before first commit on this work. |
| Build with key bundled is published somewhere | Dashboard build is never deployed today. Add a one-line "internal admin only" warning to dashboard README. |
| Engine `generateFormCoaching` signature changes | Adding a TS check in `coaching-runner.ts` prevents silent breakage; refactor renames are explicit imports. |
| Token cost during prompt iteration | Cache by default. Force-refresh button is the only way to spend a token on a previously-seen request. Show running token count per session. |
| Schema drift in `FormCoachingResultSchema` | Renderer types from the same Zod schema; new optional fields render as "—" without a code edit. |

## Acceptance

- Open Video Overlay → pick `dl-2-reps-side` → form pre-filled → click Generate → response renders within ~5s → token count visible → reload page → form values + history persist → click an old history entry → it re-renders without a new API call.
- Edit `FORM_COACHING_SYSTEM_PROMPT` in the engine → reload dashboard → cache MISS on the next Generate → new response shows.
- Set `VITE_OPENAI_KEY` to garbage → Generate shows a clear `AuthError` message, not a generic crash.
