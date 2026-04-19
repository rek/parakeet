# Dashboard Coach Panel

**Status:** Implemented (2026-04-19)
**Created:** 2026-04-19

## Problem

The Video Overlay page in the admin dashboard currently shows the deterministic CV output for a fixture: per-rep metrics, faults, verdicts, fatigue signatures, calibration check vs the manifest's expected values. It stops at the boundary the mobile app crosses next: take that analysis + the lifter's session context, hand it to gpt-5 via `generateFormCoaching`, and render a structured `FormCoachingResult` (summary, per-rep grade, prioritised cues, fatigue correlation, baseline comparison, next-session suggestion).

Today the only way to test that pipeline is to:

1. Record a real set on a phone
2. Wait for upload, on-device analysis, and the prod LLM call
3. Read the result on the mobile UI
4. Tweak the prompt or assembler in the engine
5. Build, install dev client, repeat

That loop is minutes per iteration. Prompt iteration becomes infeasible. So the prompt grows by guesswork instead of by direct comparison against fixture cases that we've already labelled (the same cases we use for the deterministic pipeline's calibration).

## Solution

Add a **Coach** panel under the per-rep table on the Video Overlay page. It consumes the analysis result that's already in scope, gathers a synthetic session context from a small input form, calls the same engine functions the mobile hook calls, and renders the same typed response shape that `FormCoachingCard` renders on mobile. Caches recent responses per video in localStorage so prompt tweaks can be diff'd side-by-side.

This is **reuse, not fork**. The dashboard adds nothing to the engine. It contributes a) inputs, b) transport, c) renderer.

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Engine source | Import `assembleCoachingContext` from `@modules/video-analysis/application/assemble-coaching-context` and `generateFormCoaching` + `FORM_COACHING_SYSTEM_PROMPT` from `@parakeet/training-engine`. Verbatim. | Forking would split the prompt — every change would need two updates and would drift. The engine functions are already pure on inputs (no RN deps); dashboard imports cleanly today. |
| 2 | Session context source | Synthetic input form on the page, defaults seeded from manifest `expected` and from typical values for the lift. Persisted in localStorage per fixture id. | A test fixture has no real DB session. The form lets the operator vary inputs deliberately to probe the prompt's sensitivity (e.g. "what does the LLM say when I claim RPE 9 vs RPE 6 on this same video?"). |
| 3 | Previous-analyses input | Empty array by default; toggle to "use the last N coached fixtures of the same lift as longitudinal context". | The mobile hook gets these from `usePreviousVideos`. Dashboard has no per-user history but can simulate "this is your 6th squat video" by feeding prior fixture analyses. Toggle keeps experiments clean. |
| 4 | LLM transport | Direct OpenAI key via `VITE_OPENAI_KEY` in `apps/dashboard/.env.local`. Admin-only, never deployed. | Routing through the production Supabase Edge Function proxy is the alternative; rejected because (a) it adds cross-env complexity to test against local fixtures, and (b) the existing rate limiter would bite during prompt iteration. The dashboard already holds a service-role key with full DB access — same security profile. |
| 5 | Model selection | Picker that defaults to whatever `getCycleReviewModel()` returns (gpt-5), with overrides for `gpt-5`, `gpt-5-mini`, `gpt-4o`, `gpt-4o-mini`. | Lets us A/B model upgrades and price/quality tradeoffs against the same fixture without engine changes. |
| 6 | System prompt override | Optional textarea that overrides `FORM_COACHING_SYSTEM_PROMPT` for that one call. Preview-only — not persisted upstream. | Direct prompt iteration without a code edit. The override is shown collapsed by default with a "modified" badge when active. |
| 7 | Response history | Last 10 responses per fixture id stored in localStorage. Each entry stores the request (context + prompt + model) and the response + timing. | Compare prompt v1 vs v2 outputs for the same fixture. Without history we lose the comparison the moment we tweak. 10 keeps storage small. |
| 8 | Render shape | Mirror the data hierarchy of `FormCoachingCard` (summary, per-rep grades, cues sorted by priority, fatigue correlation, baseline comparison, next-session suggestion, competition readiness) but styled to match dashboard tokens. Don't try to share components — RN and web styling diverge. | Same data, different surface. The shared schema (`FormCoachingResult`) is the contract. Sharing components would force a cross-platform abstraction layer that pays no dividend. |
| 9 | Caching strategy | Identical request hash → return cached response, no LLM call. Otherwise call. Force-refresh button bypasses cache. | Saves spend during prompt-rendering iteration. Hash includes context, prompt override, model — anything that could change the response. |
| 10 | Error surfacing | LLM errors render in-place with the request that produced them. Auth / rate-limit / structured-output validation errors get distinct messaging. | When the prompt produces invalid JSON we want to see WHAT the model returned, not just "validation failed". |
| 11 | No DB writes | Dashboard never writes the response back to `session_videos.coaching_response`. | Test fixtures aren't real session_videos rows; writing would corrupt prod data. The Coach panel is read-only against the engine. |
| 12 | Module placement | New `apps/dashboard/src/lib/coaching-runner.ts` (transport + cache) and `apps/dashboard/src/app/coach/*` (panel + sub-components). | Keep the page component lean — extract transport + history into reusable units. The page composes them. |

## Synthetic context input form

| Field | Type | Default | Why it matters |
|---|---|---|---|
| Weight (kg) | number | inferred from lift × % of plausible 1RM | Prompt uses absolute weight to anchor effort comments. |
| Target reps | number | 5 | Affects "you completed N of K planned" framing. |
| Set RPE | 5–10 stepper | 8 | Set RPE is the single biggest knob on the LLM's tone. |
| 1RM (kg) | number, nullable | null | Triggers "% of 1RM" framing in the response. |
| Biological sex | male / female / null | null | Used by sex-differentiated coaching cues. |
| Block / week / intensity_type | freeform | null / null / null | Supplies programming context (deload? hypertrophy block?). |
| Soreness ratings | per-muscle 0–4, collapsible | empty | Drives fatigue correlation prose. |
| Sleep quality / energy | 0–10 sliders | null / null | Drives "off-day" framing. |
| Active disruptions | array `{ type, severity }` | empty | Drives injury-aware cues. |
| Use prior fixtures as longitudinal context | toggle | off | When on, includes the last N analysed fixtures of the same lift as `previousAnalyses`. |

All defaults are stored per-fixture in localStorage so the operator's inputs persist across reloads.

## Render: response panel

```
┌─ Coach (gpt-5 · 4.7s · cache MISS · 1483 in / 612 out) ─┐
│                                                          │
│ Summary                                                  │
│   "Solid first two reps; bar drift increased markedly… "│
│                                                          │
│ Per-rep                                                  │
│   R1  GOOD  white   "Clean lockout, neutral spine."     │
│   R2  GOOD  white   "Consistent depth and timing."      │
│   R3  ACCEPT bord   "Hips shot up before chest."        │
│                                                          │
│ Cues (sorted by priority)                                │
│   ▸ HIGH   reps 3-5 — "Drive heels through the floor…"  │
│   ▸ MED    reps 1-5 — "Eyes 2m ahead — keep neutral…"   │
│                                                          │
│ Fatigue correlation                                      │
│   "Velocity dropped 28% from R1 to R3, consistent with…"│
│                                                          │
│ Baseline comparison                                      │
│   "Bar drift is 1.4× your 6-video average — first time…"│
│                                                          │
│ Competition readiness   2/3 white lights                 │
│   ✓ Depth   ✗ Bar path   ✓ Lockout                      │
│                                                          │
│ Next session                                             │
│   "Drop top set to 8 RIR, focus on R3 cue."             │
└──────────────────────────────────────────────────────────┘
```

## Decisions deferred

- **Multi-fixture batch eval.** Run the same prompt across all 16 fixtures and aggregate cue distributions. Powerful for prompt regression testing but a larger UI lift; defer.
- **Diff view between two responses.** Side-by-side col-by-col diff of two cached responses. Useful but the linear history list with timing already supports the workflow.
- **Replay against engine version.** Pin the exact engine commit a response was generated against. Out of scope until we version the engine.

## Risks

| Risk | Mitigation |
|---|---|
| OpenAI API key leaks via build artefact | `.env.local` is gitignored; vite-build-with-key is fine for a local-only admin tool but **never** deploy this build. Add a one-liner README warning. |
| Cache stale when engine prompt changes | Cache key includes the system prompt text. When the upstream prompt edits, hashes diverge → fresh call. |
| LLM returns invalid JSON | Surface the raw model output AND the Zod parse error so prompt iteration is guided. Don't crash. |
| Cost runaway during iteration | Each call shows token count + estimated cost in the response header. Cache by default. |
| Context form drift from `FormCoachingContext` shape | Form fields keyed off the same TS type. Adding a field to the context surfaces a TS error in the form. |
