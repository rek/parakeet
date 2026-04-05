# Spec: LLM Challenge Mode

**Status**: Planned
**Domain**: AI Integration

## What This Covers

Two async LLM features that validate and score JIT engine decisions without blocking the user:

1. **Post-Hoc Review Judge** — fires after JIT generation, reviews formula output during warmup, surfaces concerns via banner
2. **Decision Replay Scoring** — fires after session completion, scores prescription vs actual outcomes, logs to dashboard

Also: expand `jit_input_snapshot` to store full JITInput, fix stale model references in `ai-overview.md`, add dashboard pages.

Design doc: [llm-challenge-mode.md](./design-challenge-mode.md)

## Tasks

### Zod Schemas

**`packages/shared-types/src/challenge.schema.ts`** (new):

- [ ] `JudgeReviewSchema` — structured LLM output for post-hoc review
  - `score: z.number().int().min(0).max(100)` — overall quality rating
  - `verdict: z.enum(['accept', 'flag'])` — binary decision
  - `concerns: z.array(z.string().max(200)).max(3)` — specific issues found
  - `suggestedOverrides: z.object({ intensityModifier?, setModifier?, auxOverrides? }).optional()` — partial fix the user can accept
- [ ] `DecisionReplaySchema` — structured LLM output for retrospective scoring
  - `prescriptionScore: z.number().int().min(0).max(100)` — how appropriate was the prescription
  - `rpeAccuracy: z.number().int().min(0).max(100)` — how close prescribed RPE was to actual
  - `volumeAppropriateness: z.enum(['too_much', 'right', 'too_little'])`
  - `insights: z.array(z.string().max(200)).max(5)` — patterns or observations
- [ ] Export types (`JudgeReview`, `DecisionReplay`) and schemas from `packages/shared-types/src/index.ts`

---

### System Prompts

**`packages/training-engine/src/ai/prompts.ts`:**

- [ ] `JUDGE_REVIEW_SYSTEM_PROMPT` — expert coach reviewing a generated session plan
  - Receives JSON: `{ input: JITInput, output: JITOutput, rationale: string[] }`
  - Score 80–100 if the prescription reasonably handles the signals
  - Flag (score < 70) only for genuine missed interactions: double-penalties (soreness + disruption on same muscle), volume despite high days-since-last-session, aux conflicting with main lift soreness, inappropriate rest for RPE/disruption combo
  - Never flag stylistic differences (e.g. "I would have reduced by 5% instead of 2.5%")
  - `suggestedOverrides` only when there's a concrete actionable fix
- [ ] `DECISION_REPLAY_SYSTEM_PROMPT` — sports scientist analyzing prescription accuracy
  - Receives JSON: `{ prescription: { plannedSets, auxiliaryWork }, actual: { completedSets, actualRpe, auxiliarySetsCompleted, sessionRpe }, context: { lift, intensityType, blockNumber, sorenessRatings, sleepQuality, energyLevel } }`
  - RPE deviation > 1.5 is significant (might indicate over/under-prescription)
  - Volume appropriateness: under = user couldn't complete ≥ 80% of prescribed sets OR RPE was ≥ 9.5; over = user completed all sets at RPE ≤ 7.0; right = everything else
  - Account for the fact that high RPE can mean "good hard session" (intended) not just "over-prescribed"
  - Insights should identify patterns, not just restate numbers

---

### Engine Review Functions

**`packages/training-engine/src/review/judge-reviewer.ts`** (new):

- [ ] `reviewJITDecision(input: JITInput, output: JITOutput): Promise<JudgeReview>`
  - Calls `generateText()` with `JIT_MODEL`, `JUDGE_REVIEW_SYSTEM_PROMPT`, `Output.object({ schema: JudgeReviewSchema })`
  - 8s timeout via `AbortSignal.timeout(8000)`
  - On any error (timeout, parse, network): return `{ score: 100, verdict: 'accept', concerns: [] }` (silent pass — never block on failure)
- [ ] Export from `packages/training-engine/src/index.ts`

**`packages/training-engine/src/review/decision-replay.ts`** (new):

- [ ] `DecisionReplayContext` type — `{ jitInputSnapshot: JITInput, plannedSets, actualSets, auxiliarySets, sessionRpe, lift, intensityType, blockNumber }`
- [ ] `scoreDecisionReplay(context: DecisionReplayContext): Promise<DecisionReplay>`
  - Calls `generateText()` with `JIT_MODEL`, `DECISION_REPLAY_SYSTEM_PROMPT`, `Output.object({ schema: DecisionReplaySchema })`
  - 10s timeout
  - On any error: throw (caller catches — fire-and-forget pattern)
- [ ] Export from `packages/training-engine/src/index.ts`

---

### Database Tables

**`supabase/migrations/YYYYMMDD000000_add_challenge_mode_tables.sql`** (new):

- [ ] `challenge_reviews` table:
  - `id UUID PK DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES profiles(id)`
  - `session_id UUID NOT NULL REFERENCES sessions(id)`
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - `score INTEGER NOT NULL`
  - `verdict TEXT NOT NULL` — 'accept' or 'flag'
  - `concerns JSONB NOT NULL DEFAULT '[]'`
  - `suggested_overrides JSONB`
  - RLS: `user_id = auth.uid()` for SELECT/INSERT
  - Index: `(user_id, created_at DESC)`

- [ ] `decision_replay_logs` table:
  - `id UUID PK DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES profiles(id)`
  - `session_id UUID NOT NULL REFERENCES sessions(id)`
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - `prescription_score INTEGER NOT NULL`
  - `rpe_accuracy INTEGER NOT NULL`
  - `volume_appropriateness TEXT NOT NULL`
  - `insights JSONB NOT NULL DEFAULT '[]'`
  - RLS: `user_id = auth.uid()` for SELECT/INSERT
  - Index: `(user_id, created_at DESC)`

- [ ] Update `supabase/types.ts` with new table types

---

### Expand JIT Input Snapshot

**`apps/parakeet/src/modules/jit/lib/jit.ts`** (line ~281):

- [ ] Change `jit_input_snapshot` from minimal `{ sessionId, lift, blockNumber, intensityType }` to full `toJson(jitInput)`
  - Column is already JSONB — no migration needed
  - ~2KB per session, acceptable storage cost

---

### App Integration — Judge (Post-JIT)

**`apps/parakeet/src/modules/jit/lib/jit.ts`:**

- [ ] After JIT output is persisted (line ~289), fire judge as fire-and-forget:
  - `reviewJITDecision(jitInput, jitOutput).then(review => insert to challenge_reviews).catch(captureException)`
  - Same pattern as existing `comparisonLogger`

**`apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`:**

- [ ] Add React Query hook: fetch `challenge_reviews` for this session_id
  - `refetchInterval: 3000` (poll every 3s while no result)
  - Stop polling after first result or 30s
- [ ] If `verdict === 'flag'`: render dismissable amber `ChallengeBanner` above the set list
  - Shows first concern as summary text
  - Tap to expand: show all concerns
  - "Dismiss" button marks as dismissed (local state only, no DB write needed for v1)

---

### App Integration — Replay (Post-Completion)

**`apps/parakeet/src/modules/session/application/decision-replay.service.ts`** (new):

- [ ] `scoreDecisionReplayAsync(sessionId: string, userId: string): Promise<void>`
  - Fetch session (needs `jit_input_snapshot`, `planned_sets`, `primary_lift`, `intensity_type`, `block_number`)
  - Bail if `jit_input_snapshot` is null (ad-hoc/free-form sessions)
  - Fetch session log (needs `actual_sets`, `auxiliary_sets`, `session_rpe`)
  - Call `scoreDecisionReplay()` from training-engine
  - Insert result into `decision_replay_logs`
  - All wrapped in try/catch — fully fire-and-forget

**`apps/parakeet/src/modules/session/application/session.service.ts`:**

- [ ] In `completeSession()`, after `updateSessionToCompleted()` (line ~311), fire replay:
  - `scoreDecisionReplayAsync(sessionId, userId).catch(captureException)`
  - Same fire-and-forget pattern as cycle review trigger

---

### Dashboard Pages

**`apps/dashboard/src/pages/ChallengeReviews.tsx`** (new):

- [ ] Table view of `challenge_reviews` sorted by `created_at DESC`
  - Columns: date, lift (from session join), score, verdict, concerns
  - Color-code score: green (80+), amber (60-79), red (<60)
  - Summary stats at top: average score, flag rate, total reviews

**`apps/dashboard/src/pages/DecisionReplay.tsx`** (new):

- [ ] Table view of `decision_replay_logs` sorted by `created_at DESC`
  - Columns: date, lift, prescription_score, rpe_accuracy, volume_appropriateness, insights
  - Trend line: prescription_score over time
  - Per-lift average breakdown
  - Filter by lift, intensity type

- [ ] Add routes for both pages in dashboard navigation

---

### Documentation Updates

**`./design-overview.md`:**

- [ ] Fix stale model references:
  - "Claude via Vercel AI SDK" → "LLM via Vercel AI SDK"
  - "Claude Haiku only" → "`JIT_MODEL` only"
  - `generateObject()` → `generateText()` with `Output.object()`
  - "sent to Haiku" → "sent to `JIT_MODEL`"
  - "Sonnet uses phase data" → "`CYCLE_REVIEW_MODEL` uses phase data"
- [ ] Add §10 Post-Hoc Review Judge and §11 Decision Replay Scoring (following existing format: trigger, input, output, failure mode, key files)

**`./design-challenge-mode.md`:**

- [ ] Status → Implemented (after all tasks complete)

**`../../specs/implementation-status.md`:**

- [ ] Add challenge mode specs under AI section; check off when complete

---

### Unit Tests

**`packages/training-engine/src/review/__tests__/judge-reviewer.test.ts`:**

- [ ] Returns silent pass on timeout/error
- [ ] Parses valid LLM response into `JudgeReview`
- [ ] Validates schema enforcement (score out of range → error)

**`packages/training-engine/src/review/__tests__/decision-replay.test.ts`:**

- [ ] Parses valid LLM response into `DecisionReplay`
- [ ] Throws on timeout (caller handles fire-and-forget)
- [ ] Validates schema enforcement

## Dependencies

- [ai-001-vercel-ai-sdk-setup.md](./ai-001-vercel-ai-sdk-setup.md) — SDK, models, prompts, constraint constants
- [engine-007-jit-session-generator.md](../jit-pipeline/spec-generator.md) — JITInput, JITOutput types
- [engine-023-hybrid-jit-generator.md](../jit-pipeline/spec-hybrid.md) — comparison logging pattern, fire-and-forget pattern
- [mobile-005-session-logging-screen.md](../session/spec-logging.md) — session screen where ChallengeBanner renders
