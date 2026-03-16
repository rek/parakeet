# AI Workflow

Use this process for non-trivial work.

## 0) Orient

Before any design or implementation:

- Check [README.md](../README.md) to find relevant modules and their paths.
- Check [implementation-status.md](../specs/implementation-status.md) to see what's already built.
- Check `apps/parakeet/src/modules/<feature>/index.ts` for the current public API before adding new exports.

## 1) Design

- Create/update a design doc in `docs/design/`.
- Use `docs/design/_TEMPLATE.md`.
- Focus on problem, constraints, architecture impact, rollout.

## 2) Plan

- Create/update implementation tasks in `docs/specs/`.
- Keep tasks small and ordered.
- Note unresolved questions explicitly.

## 3) Implement

- Follow boundaries in `project-organization.md`.
- Prefer module public APIs (`@modules/<feature>`).
- Keep infra in `@platform/*`; cross-feature code in `@shared/*`.
- Avoid introducing legacy top-level folders.

## 4) Validate

For app refactors, run:

- `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json`
- `npm run check:module-boundary`

For the dashboard app:

- `tsc --noEmit -p apps/dashboard/tsconfig.app.json`
- `npx nx lint dashboard`

Add targeted tests when moving logic or changing behavior.

## Dashboard-specific conventions

- Lint: `npx nx lint dashboard` — uses oxlint (same as `apps/parakeet`)
- Theme: all colours/borders must use `src/lib/theme.ts` constants or CSS vars from `src/styles.css`; no raw `rgba()`/hex in component files
- Interactive divs: use `<button className="btn-reset">` not `<div onClick>`
- Env switching: `SupabaseContext` — all components get `supabase` via `useSupabase()`, add to `useEffect` deps

## 5) Wrap Up

After implementation:

1. Update design doc status from **Draft** → **Implemented** and add spec file links.
2. Write or update spec files to match what was actually built (not what was originally planned).
3. Update `../specs/implementation-status.md` — new checklist entries, corrected test counts, new migrations.
4. Update `supabase/types.ts` if you added migrations without running `npm run db:types` (see dev.md).
5. Review these workflow docs for any learnings and update them.
6. Close any associated Github Issues or remove items from backlog.md

## Prompt Starter

```text
Implement <feature/change> using docs/guide/project-organization.md and docs/guide/code-style.md.
Start by creating/updating:
1) docs/design/<name>.md
2) docs/specs/<id>-<name>.md
Then implement in small slices with validation after each slice.
At the end: update design doc status, finalize specs, update implementation-status.md.
```

## Key Learnings

### Database & Schema

**Nullable schema columns cascade** — making a DB column nullable requires updating: the migration, `supabase/types.ts`, Zod schemas in `shared-types`, domain types in `shared/types/domain.ts`, and every call site that assumed the value was always present. Grep the column name across the full codebase before starting; the cascade always reaches further than expected.

**`supabase/types.ts` must be kept in sync with migrations** — `npm run db:types` is the correct path. If local Supabase is not running, hand-edit cautiously and note it for the next `db:reset` run.

**Sentinel values need constraint updates** — when using a new enum-like value as a sentinel (e.g., `intensity_type = 'import'`), check whether the column has a DB CHECK constraint and update it in the same migration. Forgetting this produces a runtime error, not a TypeScript error.

**`createClient` without Database generic resolves to `never` table types** — in CLI scripts outside the app build system, `createClient()` (without type params) gives a client where all `.from()` calls produce `never`. Fix: `createClient<any>()`. The alternative (importing Database from `supabase/types.ts`) requires tsconfig path resolution that CLI scripts don't have.

**Verify column names against migrations, not sibling query files** — always verify against the migration SQL (`supabase/migrations/`). A silently wrong column name causes the query to return no data with no error thrown.

**Strip-then-insert patterns silently discard data** — when a field (e.g. `is_completed`) is stripped before a DB insert, make sure the filter happens _before_ the strip. The pattern `rows.map(({ flag, ...rest }) => rest)` stores everything; the correct pattern is `rows.filter(r => r.flag).map(({ flag, ...rest }) => rest)`.

### UI & Components

**Extract modal components immediately** — any modal with its own text input, local state, and button logic is a natural component boundary. If you write it inline, extract it in the same session before committing. The rule: if it has its own `useState`, it should be its own component.

**Left-right scrollers are UX dead-ends for lists longer than ~5 items** — replace with a tap trigger → bottom-sheet modal pattern: a `TouchableOpacity` trigger showing the current value, a `Modal` (transparent, `animationType="fade"`, `justifyContent: "flex-end"`) containing a `TextInput` search bar and `FlatList`. This is the canonical React Native picker pattern for lists where the user may not know the order. The search is a case-insensitive substring filter applied to the pool array.

**Status indicators need both a dot and a text label** — a coloured dot conveys "something is different" but not "what is different". Red dots for `skipped`, `missed`, and `in_progress` (before the "Active" badge was added) are indistinguishable. Add a text pill badge alongside any dot that represents a non-obvious terminal state. The rule: if a user would need to remember a colour legend, add a label.

**Extract components at component boundaries, not at file-length thresholds** — the signal to extract is "does this have its own `useState`?", not "is the file getting long?". `MuscleChips` and `SlotDropdown` each had independent state or responsibilities and were extracted immediately. Inline components with their own state make the parent hard to reason about. Group related extracted components in a feature subfolder (e.g., `components/settings/`) rather than dumping them into a generic `components/ui/`.

**Shared modals need context props, not component duplication** — when the same modal (`AddExerciseModal`) is used in two contexts (session ad-hoc add vs. settings pool add), each context knows things the modal doesn't (which lift, which exercises are already added). The correct fix is props (`defaultLift`, `excludeNames`), not duplicating the component. Signal: the calling site has data that would change the modal's behaviour.

**LLM personalisation needs real performance numbers, not just categorical tags** — a motivational message context with only categorical metadata (RPE bucket, performance vs plan, PR boolean) gives the LLM nothing specific to reference. Include actual numbers: `topWeightKg` (max weight across sets), `totalSetsCompleted`, `completionPct`. The source for these is `session_logs.actual_sets` (JSONB array) and `session_logs.completion_pct`. Convert grams to kg at the service layer before passing to the LLM.

**Formula estimates make "pending" screens useful** — for screens that show an upcoming but not-yet-generated session, run the same deterministic formula the JIT will use (same function, same inputs) to produce an estimate. Label it clearly as an estimate. This turns a nearly-empty card into actionable information without adding any new API surface or async work beyond what was already needed.

### Engine & Domain Logic

**Default params over guard clauses for backward-compatible engine changes** — when adding a configuration parameter to a pure function (e.g., `barWeightKg`), use a default argument (`barWeightKg = 20`) rather than null checks or overloaded signatures. This keeps all existing call sites and tests passing with zero changes. Reserve null-checking for parameters that are genuinely optional at runtime (user-supplied data that may be absent).

**Check all sibling files that implement the same interface** — when adding a required field to a shared interface (`AuxiliaryWork.exerciseType`), grep for all files that construct that type, not just the primary one. `llm-jit-generator.ts` constructed `AuxiliaryWork` objects independently of the formula generator and was missed until the typecheck caught it. The rule: required interface fields require a codebase-wide grep for every construction site.

**SDK version mismatches across workspace packages** — when the same SDK (e.g. `@ai-sdk/openai`) exists in multiple workspace packages at different major versions, the type systems are incompatible. Fix: reuse the model instance from the package that has the compatible version (export `JIT_MODEL` from training-engine) rather than duplicating the model creation. Export model constants from a central location (`training-engine/src/ai/models.ts`) — prevents version drift and avoids duplicate API key resolution. Always check `npm ls <pkg>` before adding AI SDK calls in a new location.

### Architecture & Workflow

**Design ceremony proportional to scope** — new architectural concepts (new data model, new program mode) warrant design doc → spec → implement; the user review pass catches regressions before any code is written. Simple UI additions (a button, a modal, no DB changes) can go straight to implement → typecheck → spec after. A one-time admin operation (import, backfill) is a CLI script, not a mobile screen. Match the ceremony to the blast radius.

**Separate orchestration files for cross-cutting concerns** — when the same "build + persist" pattern appears in two different service files, extract it into a dedicated file before it drifts further. Name it after the domain concept, not the service that first needed it (e.g., `unending-session.ts`). The right module home is the one that owns the data.

**Match the tool to the scope** — ask: who runs this, how often, and is it reversible? "One person, once, manually" → CLI script, not a mobile UI.

**Lazy generation pattern for unending modes** — check for an existing record first, then generate and persist only if missing. Never generate unconditionally or you'll duplicate rows across concurrent requests.

**Skip flags on sequence-advancing operations break invariants** — adding a `skipCounterIncrement` flag to `appendNextUnendingSession` leaves the counter behind the number of sessions generated. The next caller re-generates the same position. Always advance state after creation, including at program creation. If a call site needs a different starting value, pass it as input — don't suppress the side effect. Note: idempotency guards (checking whether a planned session already exists) protect against concurrency, not stale counters — they're separate invariants.

**New service files need regression tests for creation flows** — `program.service.ts` had no test file, leaving the unending program creation + first-session counter path untested. A single test ("after creating an unending program, counter = 1") would have caught this immediately. Every new service file should have at least one end-to-end flow test for its primary write path.

**Regression guards to write first** — before implementing unending logic, write the guards that prevent regressions in the scheduled path: `fetchOverdueScheduledSessions` filtering by `program_mode`, `completeSession` checking `program_mode` before the 80% gate. Write these before the feature code so they're in place from the start.

**Audit all mode-unaware code paths when adding a new program mode** — when a new mode is introduced (e.g., `unending`), systematically grep for every place that makes a completion-percentage or session-count decision. Achievement detection hooks, notification logic, and "show completed session" queries are all candidates that may not be in the same module as the core mode logic. A missed guard produces subtle wrong-behaviour bugs (spurious badges, blocked next-session generation) that only surface at runtime.

**The "return completed session as today's session" pattern needs mode-awareness** — `fetchTodaySession` returning completed sessions within 24h is correct for scheduled mode (shows the user what they did today) but blocks lazy generation in unending mode (prevents training again the same day). Whenever a query has this "show recent completed" behaviour, consider whether it needs a mode branch in the service layer rather than in the query itself.

**Update docs after matches reality** — the plan file captures intent; the spec captures what was actually built. These often diverge (file locations, type constraints, import patterns). Always re-read the actual code before writing the final spec.

**Test data must reflect global sort order, not just the muscle you care about** — when a function selects "top N by deficit", seeding `weeklyVolumeToDate: {}` makes ALL muscles deficient. The muscle the test targets may not be in the top N. The correct pattern is to set all other muscles to their MEV in `weeklyVolumeToDate` so only the muscle under test remains deficient. A helper like `atMevExcept(mrvMev, 'hamstrings')` avoids repetition and makes intent clear.

**Bug items are often pre-conditions for features** — Bug 1 (exercise types) was a prerequisite for the JIT auto-augment feature. Resolving the bug first created the `ExerciseType` system that the JIT augment logic will need to filter its exercise candidates. Check the backlog for bug items before planning a new feature — the bug fix may be the right first step.

**Sub-function caps don't prevent overflow at the aggregation layer** — a cap inside `buildAuxiliaryWork` couldn't guard against items added later by `buildVolumeTopUp` because both push to the same list and are called sequentially by the orchestrator. The correct fix is a global guard after all contributors have run. Pattern: if multiple sub-functions append to the same output list, enforce the combined size limit at the call site, not inside individual contributors.

**Type-narrowed cycle indices hide out-of-range bugs** — `blockNumber: 1 | 2 | 3` looked correct but silently broke for programs > 9 weeks. TypeScript's narrow union only expresses intent, not a runtime guarantee when values come from external data or arithmetic. For cyclic values, widen to `number` and apply explicit modulo at the computation site (`((n - 1) % 3) + 1`). Reserve narrow unions for inputs that are genuinely bounded by callers you fully control.

**Sentinel vs nullable: choose based on semantic correctness** — if a column is `NOT NULL` but merely irrelevant for a new session type (e.g., `week_number` for ad-hoc), use a sentinel (0) — cheaper, no cascade. If a column is semantically wrong for a new mode (e.g., `primary_lift` for a free-form workout), make it nullable despite the cascade — sentinels pollute queries, break Zod parsing, and require more guards. The cascade is mechanical: `!` assertions where values are always present, `?? ''` fallbacks for display, type widening in interfaces.

### Agent Patterns

**Read the actual data before designing** — always check the actual input/schema before finalising a design. In a backlog.md workflow, if a file path is provided, scan it during Orient rather than waiting until implementation.

**Feature requests often surface latent data bugs** — trace display problems back to the write path before adding view-layer filters. A view-layer filter is wrong if the source data is incorrect.

**Bug reports are two-part: DB write path + UI refresh path** — when a user reports "it still shows X after I did Y", check two things: (1) did the write actually change the DB? and (2) did the UI query get invalidated after the write? Missing cache invalidation after a mutation is the most common cause of "stale UI" bugs. Always pair every mutation with `queryClient.invalidateQueries` for every query key whose data it changes.

**GH issues are a signal to check spec gaps, not just code bugs** — when a bug report arrives, trace it back to the spec. If the spec doesn't mention the missing behaviour (e.g., no text badge for skipped sessions, no query invalidation requirement), update the spec so the same gap can't appear again in future implementations or AI agent runs.

**Review the affected screen before writing new features** — reading `auxiliary-exercises.tsx` before implementing the catalog surfaced four independent bugs: wrong query key, stale assignment after pool change, no lift context to the modal, no dirty indicator. A pre-implementation screen review takes ~5 minutes and catches issues that would otherwise ship alongside the new feature. Standard checklist: query keys match `qk.*`; mutations invalidate relevant queries; props flow context the child needs; state is validated on change.

**Query keys must use the canonical `qk` helper — no raw arrays** — `['programs', 'active', userId]` vs `['program', 'active', userId]` differ silently. Raw array keys cannot be invalidated by `qk.*` calls in other parts of the app (disruption apply, session complete, onboarding). Import `qk` from `@platform/query` and use it everywhere. The only exception is a query that nothing else in the app needs to invalidate.

**Cross-component state changes need explicit validation** — removing an item from a list (`pool`) that is also referenced by sibling state (`assignments`) silently leaves stale references. The `onPoolChange` handler must also update every dependent state. Pattern: whenever one state is a subset or filter of another, the change handler for the base state must validate and repair the derived state.

**Unify AsyncStorage keys across related UI** — when two UI components independently persist the same logical setting (e.g., bar weight in `PlateCalculatorSheet` and a new settings toggle), they must share one key. One source of truth in AsyncStorage, one set of get/set helpers in the settings module. Diverging keys cause silent divergence: the user sets 15 kg in one place and sees 20 kg in another.

**Grep for literal magic numbers before treating them as "just a constant"** — `20` in this codebase appeared in four separate files as the bar weight. A search for the number alone is noisy; search for the concept (`bar`, `barKg`, `Math.max.*20`) across the relevant packages before writing the first line of code. This surfaces all the places the new parameter must reach.

**Weekly thresholds need pro-rating when checked per-session** — a weekly target (MEV) compared against volume-to-date on session 1 of 3 will always show a deficit, because the lifter hasn't trained yet. Pro-rate the threshold by week progress: `ceil(target × sessionIndex / totalSessions)`. This pattern applies anywhere a cumulative weekly metric is checked mid-week. The key inputs are `sessionIndex` (completed + 1) and `totalSessionsThisWeek` (from session count or `training_days_per_week` for unending programs).

**Dashboard Timeline is the canonical aggregation** — when adding any new dashboard page backed by its own table, also add it to the Timeline's `Promise.all`, `typeConfig`, `Stats`, and `StatCard`. See `docs/design/dashboard.md` for the full checklist.

**Overlapping UI states with contradictory messages are a class of UX bug** — when multiple overlays or prompts can appear simultaneously, check for contradictory messages. "Go lift!" + "How'd that feel?" is a real case: the RPE picker survived the rest-timer-to-PostRestOverlay transition because the transition didn't clear pending state. Fix pattern: explicitly clear any state that belongs to the previous UI mode when transitioning to the next. In React: clear in the handler, not in a `useEffect`.

**Failed/abandoned paths need data capture too** — a "Failed" button that dismisses an overlay without logging is a data quality hole. Every outcome path in a workout (complete, partial, failed, skipped) should write actual values to the store. If the spec doesn't say what data a failure records, it's incomplete. Check the write side of every non-happy-path action.

**Mixed 1-indexed and 0-indexed conventions cause off-by-one bugs** — DB `set_number` is 1-indexed; JS arrays are 0-indexed. `pendingMain = 1` means "set 1 just rested" → next set is `plannedSets[1]` (0-indexed), not `plannedSets[0]`. Rule: always annotate which convention a variable uses in comments when it participates in array indexing. The next set is `plannedSets[pendingMain]`; the current set is `plannedSets[pendingMain - 1]`.

**Check implementation-status.md for number conflicts before assigning a spec number** — a spec file and a future-planned entry in implementation-status can silently share the same number. Always grep `mobile-0NN` in implementation-status.md before naming a new spec file.

**Narrow union types (`1 | 2 | 3`) are invisible range constraints that don't enforce their own invariants** — typing `blockNumber: 1 | 2 | 3` communicates intent but doesn't generate assignments for blocks 4+. The type became a fig leaf: callers added `as 1 | 2 | 3` casts to silence TypeScript rather than fixing the underlying gap. Pattern: when a union type is backed by a loop (`for i = 1 to 3`), the loop is the real constraint — widen both together. Narrow unions only belong where the domain is permanently bounded (e.g. `slot: 1 | 2` for a two-slot auxiliary system).

**Downstream workarounds signal an upstream bug** — the simulator had a comment "wrap to 1-3 since rotator generates 3 blocks" and a `((blockNum - 1) % 3) + 1` workaround. That comment is a direct pointer to the root cause. When you see a workaround with a comment explaining why it exists, treat the comment as a bug report and fix the root cause rather than letting the workaround proliferate.

**Type widening in a shared schema cascades to Zod validators** — widening `blockNumber` from `1 | 2 | 3` to `number` also required removing a `.max(3)` guard in `SessionSchema.block_number`. These two constraints were logically linked but appeared in separate files. Pattern: after widening a union type, grep for every Zod `.max()`, `.min()`, `.literal()`, or `.union()` that might enforce the same constraint. The Zod validator is the runtime enforcement of the type — if you widen the type but not the schema, you get silent validation failures at parse time, not compile time.

**Formula config cycling is the right pattern for periodic block structures** — the formula config has 3 block configs (`block1`/`block2`/`block3`); programs can have 4+ blocks. The correct fix is mod-3 cycling at the lookup site (`((blockNumber - 1) % 3) + 1`), not expanding the config schema. This keeps the config compact while correctly handling arbitrary program lengths. Apply this pattern anywhere a lookup table is smaller than the space of valid inputs by design.

**React component local state doesn't sync with store-driven prop changes** — `useState(initialValue)` only uses the initial value at mount. If a parent later drives a new value via props (e.g. store marks `is_completed: true`), the component won't update unless it has an explicit `useEffect` sync. Pattern: add a one-way effect `useEffect(() => { if (propVal) setLocal(propVal) }, [propVal])` for state that can be set externally. Signal: "it works when I tap it but not when driven programmatically" — always the same root cause.

**Domain semantics can eliminate UI steps** — "failed set = RPE 10 by definition" is a domain rule (in powerlifting RPE theory, reaching failure is always a 10). Recognising this removes the RPE picker entirely for failed sets and auto-populates the field. Before adding UI for user input, ask: does the domain already determine this value?

**Timed exercises need explicit opt-outs from load-set UX** — RPE picker and rest timer are load-set semantics; they fire by default for every aux set completion in `useSetCompletionFlow.handleAuxSetUpdate`. Any exercise type that doesn't fit the weight × reps model must check `exerciseType === 'timed'` and skip them. If a new exercise category is added in future, audit `handleAuxSetUpdate` first.

**Repurpose existing numeric fields before adding schema columns** — for timed exercises, `reps_completed` stores duration-in-minutes without any migration. Acceptable when the field is semantically "a quantity" and the exercise type disambiguates the unit. Document the repurpose at the call site.

**Verify catalog contents before adding entries** — always `grep` the catalog by name first. All five requested exercises (Row Machine, Ski Erg, Run - Treadmill, Toes to Bar, Plank) already existed with correct types and muscle mappings. Only the UX was broken. Duplicate entries would silently create two items in the exercise picker.

**Lift shared memo values out of sibling memos** — when two `useMemo` hooks consume the same derived array (e.g. `alreadyInSession` and `suggestedExerciseNames` both needing `auxiliaryWork.map(aw => aw.exercise)`), extract the shared value into its own memo and list it as a dependency of the others. This avoids re-allocating the array twice per render and makes the dependency graph readable. Signal: two memos with identical mapping expressions inside them.

**`defaultLift` on a modal is context, not a default** — when a modal is opened from a screen that has lift context (`primary_lift`), always pass it as `defaultLift`. The prop auto-selects the correct filter tab so the user lands on the relevant section immediately. Omitting it forces the user to manually select the lift every time.

**Expose JSON parsers through the module API, not inline in screens** — `app/` screens are routing/composition only. When a service returns a raw DB row (e.g. `session.planned_sets: Json | null`), the JSON parsing belongs in the module's `data/` codecs layer, exported from `index.ts`. Doing `SomeSchema.parse()` inline in a screen couples the view layer to the persistence schema. Rule: if parsing is needed in a screen, it should already be a module export; add it if missing.

**Null FK columns produce false-positive equality checks** — `formula_config_id` is always `null` (formula resolved at JIT runtime, not stored as FK). Comparing `null === null` across programs makes every program look identical, causing a loyalty badge ("Old Faithful") to fire for all users with 3+ programs. Pattern: when using an FK for comparison logic, guard against `null` — treat null as "unknown/not comparable" rather than "same as another null". This applies anywhere an optional FK is used for equality: membership checks, deduplication, or history comparisons.

**Aggregate badge checks that don't depend on current session sets must precede early-return guards** — checkers like `checkVolumeRepBadges` have `if (completed.length === 0) return earned` guards. New checks that use pre-fetched aggregate data (e.g., `uniqueAuxExercisesInCycle`) must be placed before the guard, otherwise they're unreachable when the session has no completed primary sets (e.g., free-form or aux-only sessions).

**Extract shared data-transformation logic before duplication reaches a third call site** — the week-bucketing logic (sessions + disruptions → `WeekStatus[]`) was duplicated across `getStreakData` and `fetchStreakBreakAndRebuild` with identical code. Extract into a utility (`buildWeekStatuses`) at the second copy, not the third. Signal: if a function body is > 20 lines and you're copying it verbatim, it's a utility.

**Static percentages break when the underlying relationship is non-linear** — `weightPct: 0.3` for dumbbell incline bench press produces correct weights at moderate 1RMs (80kg bench → 24kg DBs) but absurd weights at higher 1RMs (116kg bench → 35kg DBs). The stabilization penalty of unstable implements scales non-linearly with absolute load. Fix: sqrt scaling (`pct × sqrt(ref × oneRm)`) matches linear at a calibrated reference point and bends progressively at extremes. Pattern: when a static multiplier works at one strength level but breaks at another, the relationship is non-linear — use sqrt or log scaling with a reference midpoint, not a bigger lookup table.

**Calibrate domain constants against real-world feedback, not theory** — the catalog `weightPct` values were set once from sports science estimates and never validated against actual training. A single user report (GH#84: "couldn't even do one rep") surfaced that 4 of 10 dumbbell/kettlebell percentages were wrong (DB Snatch 0.30 should have been 0.21). When a domain constant controls user-facing output, validate it with at least one real data point per strength tier before shipping.

**Deferred prompts beat immediate prompts for reflective tasks** — post-workout body-state assessment is wrong-timing: muscles are still pumped, DOMS hasn't peaked. The fix: store the pending action in AsyncStorage when the condition is detected; surface it as a nudge card on the main screen the next time the user opens the app naturally (typically a rest day or the weekend). Pattern: AsyncStorage key + `useFocusEffect` check + auto-clear guard (`getLatestWeeklyReview` to avoid showing if already done). Add a push notification for Saturday 10am so users who forget to open the app still get prompted.

**"Later" vs "Skip" are different UX intents** — a nudge that can be dismissed permanently (Skip) vs. temporarily (Later) needs distinct handling. "Later" clears the local state (`setPendingReview(null)`) but keeps AsyncStorage, so the nudge reappears on next focus. "Review/Skip" clears AsyncStorage permanently. For reflective tasks, "Later" is the right default — don't let users accidentally dismiss data collection they might want to do.

**Pipeline "override" steps discard earlier adjustments** — JIT Step 5 was resetting `intensityMultiplier = 1.0` and `plannedCount = baseSets.length` before applying disruption modifiers. This threw away all reductions from Steps 2–4 (readiness, cycle phase, soreness). With both high soreness AND a disruption active, the system was *less* conservative than soreness alone — the opposite of intent. Fix: compound via `min()` per dimension instead of resetting. Pattern: when multiple pipeline stages modify the same output, each stage should tighten constraints, never loosen what a previous stage already set. Use `Math.min()` for reductions, never reset to base.

**"Complete next set" must carry forward actual values, not planned values** — `PostRestOverlay.handleLiftComplete` auto-completed the next set with the planned weight. If the user adjusted Set 1 from 100kg→95kg, Set 2 still pre-filled at 100kg. Same issue on the failure path. Fix: read the last completed set's actual `weight_grams` from the store. Pattern: any "auto-fill from previous" flow must read the store's actual state, not the original plan. This applies to both main lifts and auxiliary sets.

**Disruption and soreness are independent data streams that need cross-referencing** — when a user reports a disruption (e.g., Hyrox race) and later checks in sore, the system has both signals but doesn't connect them. Showing the active disruption on the soreness screen ("You reported: Hyrox race. Your soreness may be from this.") helps the user calibrate ratings accurately. The LLM prompt also benefits from explicit guidance: "consider whether reported soreness is from the disruption rather than from training."

### Testing

**Tautological tests catch nothing** — `expect(CONSTANT.field).toBe(3)` tests that a constant equals itself. If someone changes the constant, they update the test in lockstep. Replace with behavioral tests: feed the constant through the function that consumes it and verify the *output* is correct. Example: instead of "female block1 heavy has 3 sets", test "female config produces more sets than male in block 1 heavy."

**Formula-recomputing comments make tests tautological by proxy** — `// 0.15 × sqrt(120 × 180) = 22.04 → 22.5` in a test comment re-derives the expected value the same way the code does. If the formula has a bug, the test enshrines it. Replace with intent comments: "Dumbbell exercises use sqrt scaling to avoid unrealistic weights for strong lifters." Keep the hardcoded expected values as regression snapshots.

**Invariant tests catch classes of bugs that point tests miss** — a single test "weight is always a multiple of 2.5kg" running over 36 lift×intensity×1RM combinations catches rounding bugs that no amount of hand-picked examples would. Pattern: identify properties that must hold for ALL valid inputs, build a small combinatorial matrix with `it.each`, and assert the property. Good candidates: weight multiples, 1RM ceiling, sequential set numbers, rest array length parity, recovery mode structure.

**Compound interaction tests catch pipeline ordering bugs** — individual adjuster tests (soreness alone, readiness alone) pass, but the JIT pipeline applies them in sequence. A test with 3–4 adjusters active simultaneously catches: wrong ordering, one step undoing another, boundary interactions (e.g., MRV cap after soreness reduction). These are the highest-value tests for a multi-stage pipeline.

**Scenario tests are the ultimate intent tests** — "beginner female, menstrual phase, first heavy squat of the week" is a test that a powerlifting coach could read and validate. It exercises the full pipeline with realistic inputs and asserts domain-meaningful outputs. Write at least one scenario test for each major user archetype × training phase combination.

**Shared test fixtures reduce copy-drift** — `baseInput()`, `makeDisruption()`, `makeSets()` were defined locally in 3+ test files with subtle differences. Extract to `__test-helpers__/fixtures.ts`. When a fixture drifts between files, tests start testing different things silently.
