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

Severities: `CRITICAL` (data loss / crash / wrong training load) | `HIGH` (bad UX / incorrect logic) | `MEDIUM` (missing feature / inconsistency) | `LOW` (polish / minor gap)

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
- Is the RPE threshold (`>= 1.0`) consistently applied across formula and LLM generators?
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

#### 5a. Dependency Rule Violations

- Do any `app/` route files contain business logic instead of composing module APIs?
- Do any `modules/*/ui/` files import repository code directly instead of going through application services?
- Are Supabase calls happening outside of `modules/*/data/*` repositories?
- Is any business logic duplicated between `packages/training-engine` and app-layer code?
- Does `packages/shared-types` import from `packages/training-engine` (wrong direction)?
- Do any modules import from other modules' internal paths instead of their public API (`index.ts`)?
- Are `platform/` files importing from `modules/` (wrong direction)?

#### 5b. Business Logic in Components

Scan `.tsx` files in `app/` and `modules/*/ui/` for inline calculations, conditional domain logic, data transformation chains, and derived state that could be pure functions.

#### 5c. Module Shape Consistency

Each module should have: `data/`, `application/`, `ui/`, `utils/`, `index.ts`. Flag missing layers.

#### 5d. Test Coverage Gaps

- Pure functions in `modules/*/utils/` or `modules/*/lib/` without tests?
- Complex `application/` service files with untested branching logic?

---

### 6. Features That Don't Make Sense or Are Internally Contradictory

Look for logic conflicts, missing guards, dead-end UX paths, and semantic mismatches.

---

### 7. Error Handling & Resilience

- LLM call fallbacks, Supabase auth token expiry, `captureException` coverage, null program/session handling, offline sync, crash recovery

---

### 8. Missing Features vs. Spec

Check `docs/specs/implementation-status.md` against actual code. Flag specs with unchecked boxes for features that were actually built.

---

## Output Format

The final goal is to update existing `docs/design/*.md` and `docs/specs/**/*.md` files.

Design changes should be written inline in the design doc, as if they were always there.

Spec changes should be added as new checkboxes to implement.
