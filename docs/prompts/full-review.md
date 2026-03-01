# Full System Review Prompt

Use this prompt to kick off a comprehensive review session. Feed it alongside the MEMORY.md and relevant source files.

---

You are reviewing **Parakeet** — a personal powerlifting training app for two users (owner + wife). It is an Expo SDK 54 / React Native / TypeScript / Nx monorepo. All business logic runs locally; Supabase is the only backend. There is no server-side API.

Your job is a **real-world, use-case-driven review** — not a style check. Think like a lifter who actually uses this app daily. Find things that are broken, nonsensical, incomplete, or dangerous.

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

#### A. First week of a new program

- User completes onboarding → enters 1RMs → program is generated
- Open the app on Monday. Does a session exist? Is the soreness check-in gated correctly?
- JIT runs. Do the planned_sets look sane for week 1 of a Cube cycle?

#### B. Missed session on Wednesday

- User never opens the app Wednesday.
- Thursday: what does the Today screen show? Is Wednesday marked missed? When/how?
- Does the missed session affect JIT for Thursday?

#### C. Knee injury mid-cycle

- User reports injury (Squat, Moderate) from the disruption report screen.
- What gets written to DB? Does the adjustment preview show correct numbers (−40%)?
- Do subsequent JIT sessions pick up the disruption? Does it auto-clear when resolved?

#### D. Deload week

- Week 4 of a Cube cycle. Does the schedule produce deload sets?
- Is there any guard against a disruption overriding a deload?

#### E. Cycle completion → cycle review

- User completes the final session of the 4th week.
- `onCycleComplete` fires at ≥80% completion. Does `compileCycleReport` have the right data?
- Does the LLM call succeed? What happens if it times out or fails?
- Is the cycle review visible in the history screen?

#### F. Wife's account (female athlete)

- `biological_sex = female`. Does JIT pick up `DEFAULT_MRV_MEV_CONFIG_FEMALE`?
- Are `DEFAULT_THRESHOLDS_FEMALE` used for performance adjustments?
- Is `standard_female` warmup preset applied automatically or must she manually set it?

#### G. Unprogrammed event (disruptions-005)

- Is the spec implemented? If not, what breaks if a user navigates to that disruption type?
- Does the soreness injection flow work end-to-end?

---

### 2. Data Integrity & DB Correctness

- All weights stored as integer grams. Find any place a float or kg value might be written directly.
- `sessions.planned_sets`: is NULL until JIT runs. Is there any screen that renders before JIT and crashes on null?
- `personal_records` unique index — was the migration that fixed it actually applied? Check migration filenames.
- `cycle_tracking.session_id` FK — is the right ID passed everywhere (session row id, not session_log id)?
- RLS: every table should have `user_id` + policy. Are there any tables missing this?
- Are there any race conditions between `onCycleComplete` (fire-and-forget) and the user navigating to the cycle review screen?

---

### 3. JIT Pipeline Logic

Trace the 8-step JIT pipeline in `jit-session-generator.ts`:

- Does soreness input from `soreness_checkins` correctly cap volume per muscle group?
- Are active disruptions (`activeDisruptions`) correctly wired from `getActiveDisruptions()` into `JITInput`?
- Is the RPE threshold (`>= 1.0`) consistently applied across formula and LLM generators?
- `HybridJITGenerator` — does it fall back gracefully if the LLM call fails?
- `jit_comparison_logs` — is this actually written? What happens if the insert fails?
- Warmup sets: are they generated for all three main lifts? What if `warmupConfig` is null?

---

### 4. Screen-by-Screen Feature Completeness

For each screen, check: does it handle loading, error, and empty states?

- **Today** (`today.tsx`): soreness gate, disruption banner, JIT trigger, StreakPill, volume card
- **Session logging** (`[sessionId].tsx`): actual vs planned sets, RPE logging, rest timer, mid-session disruption entry point (design doc says missing — confirm)
- **Session complete** (`complete.tsx`): PR detection shown? `onCycleComplete` called? cycle phase stamped?
- **Soreness check-in** (`soreness.tsx`): does skipping soreness block JIT or allow it?
- **Disruption report** (`report.tsx`): Minor auto-apply vs Moderate confirm — is this branch actually coded?
- **Cycle review** (`history/cycle-review/[programId].tsx`): polling/realtime — does it handle the case where the review hasn't generated yet?
- **History** (`history.tsx`): archived programs with Review button — does the button navigate correctly?
- **Formula editor** (`formula/editor.tsx`): AI suggestions — do they reflect the current cycle's actual data?

---

### 5. Architecture & Dependency Rule Violations

- Do any `apps/parakeet/src/` files import directly from `packages/training-engine` bypassing lib boundaries?
- Do any `ui` libs import from `data-access` or `feature` libs?
- Are Supabase calls happening in components directly instead of via `apps/parakeet/src/lib/`?
- Is any business logic (JIT, adjustments, volume math) duplicated between `packages/training-engine` and app-layer code?
- Does `packages/shared-types` import from `packages/training-engine` (wrong direction)?

---

### 6. Features That Don't Make Sense or Are Internally Contradictory

- **Minor disruption auto-apply at −20% vs fatigue at −10%**: The design doc says "bad day fatigue → Minor → auto-applied at −10%". The disruption adjuster uses `reps_reduction` not weight reduction. Are these consistent?
- **Deload overlap**: Not implemented but no guard exists. Can a user accidentally override a deload week with a disruption?
- **Mid-session disruption**: No entry point. The session screen has no path to report an injury mid-workout. Is there at least a note or TODO?
- **`formula_config_id` is null on program insert**: If formula resolution at JIT runtime ever fails to find a config, what is the fallback? Does it use defaults silently or error?
- **Menstrual cycle phase on session complete**: `stampCyclePhaseOnSession` — what happens if the user hasn't configured cycle tracking? Does it throw or skip gracefully?
- **Offline sync** (`mobile-009`): Is this spec implemented? If not, what happens when a session is completed offline?
- **In-session history** (`mobile-021`): Is this spec implemented? Users can't see previous performance for the same lift without it.

---

### 7. Error Handling & Resilience

- LLM calls (JIT, cycle review, rest suggestions): what is the exact fallback if the API key is missing or rate-limited?
- Supabase client: what happens on auth token expiry mid-session? Is there a refresh flow?
- `captureException.ts`: is Sentry integrated on all try/catch boundaries, or only some?
- What happens if `getActiveProgram()` returns null and the user opens the Today screen?
- What happens if `findTodaySession()` returns null? Does JIT auto-create a session or does the screen show empty?

---

### 8. Missing Features vs. Spec

Check implementation status against the spec list. Flag anything marked in specs but **not** in the Completed sections:

- `mobile-009` offline sync
- `mobile-021` in-session history
- `disruptions-005` unprogrammed event (partially spec'd — is UI wired?)
- `sessions-006` missed session logic — is `markMissedSessions` called anywhere on a schedule, or only on app open?
- Any spec in `docs/specs/` that has no corresponding entry in MEMORY.md Completed sections

---

## Output Format

The final goal is to update the existing `docs/design/*.md` and `docs/spec/**/*.md` files.

Design changes should be written inline in the design doc, as if they were always there

Spec changes should be added as new checkboxes to implement