# Full System Review Prompt

Use this prompt to kick off a comprehensive review session. Feed it alongside the MEMORY.md and relevant source files.

---

You are reviewing **Parakeet** — a powerlifting training app. Expo SDK 54 / React Native / TypeScript / Nx monorepo. All business logic runs locally; Supabase is the only backend. There is no server-side API.

Your job is a **real-world, use-case-driven review** — not a style check. Think like a lifter who actually uses this app daily. Find things that are broken, nonsensical, incomplete, or dangerous.

We also want flexibility in the system, so we can expand to cover other goals (eg: hyrox) in the future. But this is only a small consideration now, but should be noted.

---

## Review Dimensions

Work through each dimension in order. For each finding, output:

```text
[SEVERITY] DIMENSION > File/Module > Short title
Detail: what is wrong and why it matters to a real user.
Fix: concrete suggestion.
```

Severities: `CRITICAL` (data loss / crash / wrong training load) · `HIGH` (bad UX / incorrect logic) · `MEDIUM` (missing feature / inconsistency) · `LOW` (polish / minor gap)

---

### 1. Real-World Use Case Walkthrough

Simulate these exact scenarios and trace what actually happens in the code:

#### A. First week of a new scheduled program

- User completes onboarding > enters 1RMs > program is generated
- Open the app on Monday. Does a session exist? Is the soreness check-in gated correctly?
- JIT runs. Do the planned_sets look sane for week 1 of a Cube cycle?

#### B. Missed session on Wednesday

- User never opens the app Wednesday.
- Thursday: what does the Today screen show? Is Wednesday marked missed? When/how?
- Does the missed session affect JIT for Thursday?
- Does `fetchOverdueScheduledSessions` correctly skip unending sessions?

#### C. Knee injury mid-cycle

- User reports injury (Squat, Moderate) from the disruption report screen.
- What gets written to DB? Does the adjustment preview show correct numbers (-40%)?
- Do subsequent JIT sessions pick up the disruption? Does it auto-clear when resolved?

#### D. Deload week

- Week 4 of a Cube cycle. Does the schedule produce deload sets?
- Is there any guard against a disruption overriding a deload?

#### E. Cycle completion > cycle review

- User completes the final session of the 4th week.
- `onCycleComplete` fires at >=80% completion. Does `compileCycleReport` have the right data?
- Does the LLM call succeed? What happens if it times out or fails?
- Is the cycle review visible in the history screen?

#### F. Female athlete account

- `biological_sex = female`. Does JIT pick up `DEFAULT_MRV_MEV_CONFIG_FEMALE`?
- Are `DEFAULT_THRESHOLDS_FEMALE` used for performance adjustments?
- Is `standard_female` warmup preset applied automatically or must she manually set it?
- Does menstrual cycle phase correctly influence soreness adjustments and JIT context?

#### G. Unending program mode

- User selects "Unending" in onboarding. Does the program generate without `total_weeks`?
- Open the app. Does `findTodaySession` lazily generate the next session?
- Complete a session. Does `unending_session_counter` increment? Can the user do another workout the same day?
- Does the "End Program" flow trigger cycle review correctly?
- Are cycle badges suppressed? Is `fetchOverdueScheduledSessions` skipping unending sessions?
- Does the program tab show the correct unending branch (no week grid)?

#### H. Unprogrammed event (disruptions-005)

- User reports a Hyrox race. Does the event name capture work?
- Does post-event soreness get injected into `soreness_checkins` with `session_id: null`?
- Does JIT pick up this injected soreness on the next session?

#### I. Ad-hoc auxiliary exercise (mobile-030)

- Mid-session, user taps "+ Add Exercise". Does the modal show available exercises?
- User adds sets. Do they persist across app backgrounding (sessionStore)?
- Are ad-hoc sets included in session completion data? Do they count toward volume?

#### J. Post-workout flow

- Session completes. Is cycle phase stamped? Are PRs detected? Is streak updated?
- Does the motivational message generate (LLM call)? What if it fails — does the complete screen still render?
- For multiple sessions in one day (unending mode), is the motivational message consolidated?

---

### 2. Data Integrity & DB Correctness

- All weights stored as integer grams. Find any place a float or kg value might be written directly.
- `sessions.planned_sets`: is NULL until JIT runs. Is there any screen that renders before JIT and crashes on null?
- `sessions.program_id` is nullable (for imports). Do any queries assume it's always present?
- `programs.total_weeks` is nullable (for unending). Do any calculations divide by or iterate over it without a null check?
- `cycle_tracking.session_id` FK — is the right ID passed everywhere (session row id, not session_log id)?
- RLS: every table should have `user_id` + policy. Are there any tables missing this?
- Are there any race conditions between `onCycleComplete` (fire-and-forget) and the user navigating to the cycle review screen?
- Bar weight setting (`bar_weight_kg` in AsyncStorage): is it consistently read by warmup calculator, plate calculator, and recovery mode floors?

---

### 3. JIT Pipeline Logic

Trace the 8-step JIT pipeline in `jit-session-generator.ts`:

- Does soreness input from `soreness_checkins` correctly cap volume per muscle group?
- Are active disruptions (`activeDisruptions`) correctly wired from `getActiveDisruptions()` into `JITInput`?
- Is the Step 2 RPE correction threshold (`>= 0.75`, tiered: small 0.75–1.25, large >= 1.25) applied consistently? Note: the performance adjuster uses separate thresholds (1.0 male / 1.5 female).
- `HybridJITGenerator` — does it fall back gracefully if the LLM call fails?
- `jit_comparison_logs` — is this actually written? What happens if the insert fails?
- Warmup sets: are they generated for all three main lifts? What if `warmupConfig` is null?
- Does JIT correctly receive `biologicalSex` and `userAge` for sex-aware adjustments?
- Are rest recommendations (`restRecommendations`) populated and passed through to the UI?

---

### 4. Screen-by-Screen Feature Completeness

For each screen, check: does it handle loading, error, and empty states?

- **Today** (`today.tsx`): soreness gate, disruption banner, JIT trigger, StreakPill, volume card, cycle phase pill (female), motivational message card (post-workout)
- **Session logging** (`[sessionId].tsx`): actual vs planned sets, RPE logging, rest timer, lift history sheet, ad-hoc auxiliary "+ Add Exercise", plate calculator
- **Session complete** (`complete.tsx`): PR detection shown? `onCycleComplete` called? cycle phase stamped? motivational message generated?
- **Soreness check-in** (`soreness.tsx`): does skipping soreness block JIT or allow it?
- **Disruption report** (`report.tsx`): Minor auto-apply vs Moderate confirm — is this branch actually coded? Unprogrammed event branch?
- **Cycle review** (`history/cycle-review/[programId].tsx`): polling/realtime — does it handle the case where the review hasn't generated yet?
- **History** (`history.tsx`): archived programs with Review button — does the button navigate correctly? Volume chart data builder?
- **Formula editor** (`formula/editor.tsx`): AI suggestions — do they reflect the current cycle's actual data?
- **Program view** (`program.tsx`): does it branch correctly for unending vs scheduled? Week/block grid vs unending display?
- **Settings** (`settings.tsx`): bar weight toggle, data export, volume config, warmup protocol, rest timer prefs, JIT strategy, developer suggestions badges

---

### 5. Architecture, Separation of Concerns & Testability

The app follows a module-first architecture. Business logic must live in testable, non-React locations. This is the most important dimension — violations here compound over time.

#### 5a. Dependency Rule Violations

- Do any `app/` route files contain business logic instead of composing module APIs?
- Do any `modules/*/ui/` files import repository code directly instead of going through application services?
- Are Supabase calls happening outside of `modules/*/data/*` repositories?
- Is any business logic (JIT, adjustments, volume math) duplicated between `packages/training-engine` and app-layer code?
- Does `packages/shared-types` import from `packages/training-engine` (wrong direction)?
- Do any modules import from other modules' internal paths instead of their public API (`index.ts`)?
- Are `platform/` files importing from `modules/` (wrong direction)?

#### 5b. Business Logic in Components

Scan React components (`.tsx` files in `app/` and `modules/*/ui/`) for:

- **Inline calculations**: any math (weight conversions, percentage calculations, volume sums, threshold comparisons, date/phase logic) that isn't delegated to a pure function in `utils/`, `lib/`, or `training-engine`.
- **Conditional domain logic**: `if/switch` blocks that encode training rules (e.g. "if RPE > 9 then...", "if severity is moderate then...") rather than presentation branching (e.g. "if loading then spinner").
- **Data transformation**: `.map`/`.filter`/`.reduce` chains that reshape domain data into derived state. These should be named pure functions, not anonymous chains inside `useMemo` or render bodies.
- **Derived state that could be a pure function**: any `useMemo` that takes domain data and produces a non-trivial result (more than simple null checks or formatting). Extract to a named, testable function.

For each violation found, suggest where the logic should live:

- Pure domain math > `packages/training-engine` (if reusable across apps)
- Module-specific domain logic > `modules/<feature>/utils/` or `modules/<feature>/lib/`
- Presentation constants (colors, labels, config objects) > `modules/<feature>/ui/`

#### 5c. Module Shape Consistency

Each module should follow the established pattern. Check that modules have:

- `data/` — repository files (Supabase queries, AsyncStorage access)
- `application/` — service/orchestration files (compose repository + engine calls)
- `ui/` — React components and presentation constants
- `utils/` — pure testable functions (no React, no IO)
- `index.ts` — public API (only re-exports what other modules need)

Flag modules that are missing layers (e.g. business logic in `data/` or `ui/` because there's no `application/` or `utils/` layer).

#### 5d. Test Coverage Gaps

- Are there pure functions in `modules/*/utils/` or `modules/*/lib/` that have no corresponding test file?
- Are there complex `application/` service files with branching logic that aren't tested?
- Is any logic only testable by running the full React component (meaning it should be extracted)?

---

### 6. Features That Don't Make Sense or Are Internally Contradictory

- **Minor disruption auto-apply at -20% vs fatigue at -10%**: The design doc says "bad day fatigue > Minor > auto-applied at -10%". The disruption adjuster uses `reps_reduction` not weight reduction. Are these consistent?
- **Deload overlap**: Not implemented but no guard exists. Can a user accidentally override a deload week with a disruption?
- **Mid-session disruption**: No entry point. The session screen has no path to report an injury mid-workout. Is there at least a note or TODO?
- **`formula_config_id` is null on program insert**: If formula resolution at JIT runtime ever fails to find a config, what is the fallback? Does it use defaults silently or error?
- **Menstrual cycle phase on session complete**: `stampCyclePhaseOnSession` — what happens if the user hasn't configured cycle tracking? Does it throw or skip gracefully?
- **Unending mode + cycle review**: Cycle review is only triggered via "End Program". If a user never ends the program, they never get coaching feedback. Is this intentional?
- **Bar weight propagation**: 15 kg vs 20 kg bar weight is in AsyncStorage. Does the engine (which defaults to 20) ever receive the user's actual bar weight, or is it only used in UI calculations?
- **Ad-hoc auxiliary volume**: Do ad-hoc sets count toward weekly MRV tracking, or are they invisible to the volume system?

---

### 7. Error Handling & Resilience

- LLM calls (JIT, cycle review, rest suggestions, motivational message): what is the exact fallback if the API key is missing or rate-limited?
- Supabase client: what happens on auth token expiry mid-session? Is there a refresh flow?
- `captureException`: is it wired on all try/catch boundaries, or only some?
- What happens if `getActiveProgram()` returns null and the user opens the Today screen?
- What happens if `findTodaySession()` returns null? Does JIT auto-create a session or does the screen show empty?
- Sync queue (offline): if MMKV has queued writes and the app is killed, do they replay on next launch?
- `sessionStore` persistence: if the app crashes mid-session, does the Zustand/MMKV store recover the in-progress sets including ad-hoc auxiliaries?

---

### 8. Missing Features vs. Spec

Check implementation status against the spec list. Flag anything in specs or design docs but **not** implemented:

- `engine-026` EMG-based muscle contribution weights (Planned — currently binary 1.0/0.5 model)
- `mobile-027` warmup set persistence (Planned — warmup sets are UI-only, never written to DB)
- `auxiliary-exercise-types` design doc (Planned — bodyweight/timed exercises get nonsensical weight assignments)
- `jit-volume-augmentation` design doc (Planned — auto-add auxiliaries when muscle below MEV)
- `data-002` auxiliary exercise config spec — check for any unchecked tasks
- Any spec in `docs/specs/` that has unchecked implementation tasks

---

### 9. AI Agent System & Documentation Review

Review how the project is organized for AI-assisted development. The goal: an agent starting a fresh conversation should be able to orient, pick up a task, implement it correctly, and leave the docs better than it found them — with minimal drift.

#### 9a. Prompt inventory

We have three prompts in `docs/prompts/`:

- `full-review.md` (this file) — comprehensive system review
- `implement-review.md` — post-review finding implementation
- `refactor.md` — code quality cleanup

(The former `senior-engineer.md` persona was merged into `docs/guide/code-style.md`.)

Evaluate:

- Is there a prompt missing? (e.g., exploration/discovery, feature implementation from scratch, bug triage, spec writing)
- Is there a prompt index or guidance on when to use which prompt?

#### 9b. Workflow automation

The gist at https://gist.github.com/manuelschipper/149ebf6b2d150ccaccc84ee9a9df560f uses `.claude/commands/` for custom slash commands that automate feature lifecycle (create, explore, verify, close). We have none.

Evaluate whether custom commands would reduce drift for:

- **New feature kickoff** — orient > check implementation-status > create design doc > create spec (currently manual per guide/ai-workflow.md)
- **Post-implementation wrap-up** — update design doc status, finalize spec, update implementation-status (currently manual, often skipped)
- **Exploration** — parallel agent deep-dive into a subsystem before starting work
- **Verification** — typecheck + lint + test + boundary check as one command

#### 9c. ai-workflow.md health

The Key Learnings section is categorized into 5 groups (Database & Schema, UI & Components, Engine & Domain Logic, Architecture & Workflow, Agent Patterns). Evaluate:

- Are any learnings now redundant with CLAUDE.md or guide/code-style.md? (deduplicate)
- Are any learnings stale or no longer applicable? (remove)
- Is the core workflow (Orient > Design > Plan > Implement > Validate > Wrap Up) still accurate and sufficient?

#### 9d. Documentation gaps and redundancy

- **MEMORY.md vs project docs**: MEMORY.md stores implementation details that arguably belong in implementation-status.md. Is MEMORY.md doing too much? Should it be trimmed to only store things that don't belong in checked-in docs?
- **Design doc freshness**: are any `docs/design/*.md` files stale (describe a planned state that was implemented differently)?
- **Spec freshness**: are there specs with unchecked boxes for features that were actually built?
- **Missing docs**: is there anything an agent needs to know that isn't written down anywhere? (e.g., how to run the app locally, how to test against prod Supabase, how the dashboard relates to the main app)

#### 9e. Feature lifecycle tracking

Currently features move from "planned" to "implemented" with no intermediate states. The gist uses eight states (Planned > Design > Open > In Progress > Pending Verification > Complete > Deferred > Closed).

Evaluate whether a lightweight lifecycle would help:

- Do features get stuck in limbo (partially implemented, no clear status)?
- Would a feature index with states reduce the need to grep across docs?
- Is `docs/backlog.md` serving as a task queue effectively, or is it stale?

---

## Output Format

The final goal is to update the existing `docs/design/*.md` and `docs/specs/**/*.md` files.

Design changes should be written inline in the design doc, as if they were always there.

Spec changes should be added as new checkboxes to implement.
