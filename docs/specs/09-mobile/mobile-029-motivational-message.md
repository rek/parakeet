# Spec: Motivational Message on Workout Completion

**Status**: Implemented

**Domain**: UI | AI

## What This Covers

The "Workout Done" card on the Today tab now shows a contextual, LLM-generated motivational message instead of a static "great work today" string. The message is personalised based on session performance (RPE, PRs, performance vs plan), athlete context (biological sex, cycle phase, streak), and workout metadata (lift, intensity, deload). Multiple completed sessions in a day are consolidated into a single card.

## Tasks

**`apps/parakeet/src/modules/session/application/motivational-message.service.ts` (new):**

- [x] `fetchMotivationalContext(sessions, currentStreak, cyclePhase): MotivationalContext` — queries `session_logs` (RPE, performance_vs_plan) and `personal_records` (PRs) for the given session IDs; fetches profile for `biological_sex`
- [x] `generateMotivationalMessage(ctx: MotivationalContext): string` — calls `JIT_MODEL` (gpt-4o-mini) via Vercel AI SDK `generateText()` with a coach persona system prompt; 8s timeout; returns 1-2 sentence message
- [x] `CompletedSessionRef` type exported for WorkoutDoneCard prop typing

**`apps/parakeet/src/modules/session/index.ts`:**

- [x] Exports `motivational-message.service` alongside existing session service

**`apps/parakeet/src/app/(tabs)/today.tsx`:**

- [x] `WorkoutDoneCard` accepts `sessions[]`, `currentStreak`, `cyclePhase` props
- [x] Uses `useQuery` with `staleTime: Infinity` and `retry: false` to fetch + generate message
- [x] Shows lift names line, then LLM message below (or loading spinner while pending)
- [x] All completed sessions grouped into one card (no duplicate cards per session)
- [x] Added `workoutDoneLift` style for the lift names sub-line

**`packages/training-engine/src/index.ts`:**

- [x] Exports `JIT_MODEL` so the app can reuse the same compatible model instance (avoids `@ai-sdk/openai` version mismatch between app v1.x and training-engine v3.x)

**System prompt priorities:**

1. New PRs — lead with specific praise (lift + PR type)
2. RPE >= 9 — acknowledge grit
3. Performance over plan — note overdelivery
4. Performance under plan — reinforce consistency
5. Deload — praise discipline
6. Streak >= 5 — weave in
7. Female + ovulatory — acknowledge hormonal phase

## Dependencies

- [mobile-004-today-screen.md](./mobile-004-today-screen.md)
- [ai-001-vercel-ai-sdk-setup.md](../10-ai/ai-001-vercel-ai-sdk-setup.md)
- [engine-022-pr-detection.md](../04-engine/engine-022-pr-detection.md)
