# AI Learnings

Reusable patterns discovered during implementation. Read on-demand when debugging, reviewing, or hitting a wall.

## Database & Schema

**Nullable schema columns cascade** — making a DB column nullable requires updating: the migration, `supabase/types.ts`, Zod schemas in `shared-types`, domain types in `shared/types/domain.ts`, and every call site that assumed the value was always present. Grep the column name across the full codebase before starting.

**Sentinel values need constraint updates** — when using a new enum-like value as a sentinel (e.g., `intensity_type = 'import'`), check whether the column has a DB CHECK constraint and update it in the same migration.

**Verify column names against migrations, not sibling query files** — always verify against the migration SQL. A silently wrong column name causes the query to return no data with no error thrown.

**Strip-then-insert patterns silently discard data** — when a field is stripped before a DB insert, make sure the filter happens _before_ the strip.

## UI & Components

**Extract components at component boundaries** — the signal is "does this have its own `useState`?", not "is the file getting long?".

**Shared modals need context props, not duplication** — when the same modal is used in two contexts, the correct fix is props (`defaultLift`, `excludeNames`), not duplicating the component.

**Status indicators need both a dot and a text label** — if a user would need to remember a colour legend, add a label.

## Engine & Domain Logic

**Default params over guard clauses for backward-compatible changes** — use default arguments (`barWeightKg = 20`) rather than null checks. Keeps all existing call sites passing.

**Check all sibling files implementing the same interface** — when adding a required field to a shared interface, grep for all files that construct that type, not just the primary one.

**Sub-function caps don't prevent overflow at the aggregation layer** — if multiple sub-functions append to the same output list, enforce the combined size limit at the call site, not inside individual contributors.

**Domain semantics can eliminate UI steps** — "failed set = RPE 10 by definition" removes the RPE picker for failed sets. Before adding UI for user input, ask: does the domain already determine this value?

**Auto-selection from cross-lift pools must be schedule-aware** — `buildVolumeTopUp` selects exercises purely by MEV deficit, ignoring upcoming lifts. This causes back-to-back muscle group loading (e.g., leg press on bench day before squat day). Fix: pass `upcomingLifts` and filter out exercises whose associated lift is scheduled later this week. Pattern: any auto-selection system drawing from a cross-lift pool must consider the training schedule, not just the deficit.

## Architecture & Workflow

**Design ceremony proportional to scope** — new architectural concepts warrant design doc > spec > implement. Simple UI additions can go straight to implement > spec after. One-time admin operations are CLI scripts, not mobile screens.

**Lazy generation pattern for unending modes** — check for an existing record first, then generate only if missing. Never generate unconditionally.

**Audit all mode-unaware code paths when adding a new program mode** — grep for every place that makes a completion-percentage or session-count decision. Achievement detection, notification logic, and "show completed session" queries are all candidates.

**Update docs after, to match reality** — the plan captures intent; the spec captures what was actually built. Always re-read the actual code before writing the final spec.

## Agent Patterns

**Feature requests often surface latent data bugs** — trace display problems back to the write path before adding view-layer filters.

**Bug reports are two-part: DB write path + UI refresh path** — check (1) did the write actually change the DB? and (2) did the UI query get invalidated? Missing cache invalidation is the most common cause of "stale UI" bugs.

**GH issues signal spec gaps, not just code bugs** — when a bug arrives, trace it back to the spec. Update the spec so the same gap can't reappear.

**Review the affected screen before writing new features** — a pre-implementation screen review catches issues that would otherwise ship alongside the new feature. Checklist: query keys match `qk.*`; mutations invalidate relevant queries; props flow context the child needs.

**Cross-component state changes need explicit validation** — removing an item from a list that is also referenced by sibling state silently leaves stale references. The change handler for the base state must validate and repair derived state.

**Weekly thresholds need pro-rating when checked per-session** — a weekly target compared against volume-to-date on session 1 of 3 will always show a deficit. Pro-rate: `ceil(target * sessionIndex / totalSessions)`.

## Testing

**Tautological tests catch nothing** — `expect(CONSTANT.field).toBe(3)` tests that a constant equals itself. Replace with behavioral tests.

**Invariant tests catch classes of bugs point tests miss** — identify properties that must hold for ALL valid inputs, build a combinatorial matrix, assert the property.

**Compound interaction tests catch pipeline ordering bugs** — individual adjuster tests pass, but the pipeline applies them in sequence. Test with 3-4 adjusters active simultaneously.

**Scenario tests are the ultimate intent tests** — "beginner female, menstrual phase, first heavy squat" exercises the full pipeline with realistic inputs.

**Shared test fixtures reduce copy-drift** — extract `baseInput()`, `makeDisruption()`, `makeSets()` to `__test-helpers__/fixtures.ts`.

### UX & Information Display

**"vs plan" is meaningless when the plan is always personalized** — JIT generates a plan adjusted for soreness, disruptions, readiness, and cycle phase. Comparing actual vs adjusted always yields ~100%. Users interpret "on plan" as "on the original schedule" not "on the adjusted plan." Fix: show adjustment context (what changed and why) instead of a misleading percentage. Surface `JITOutput.volumeReductions` and `rationale` alongside completion stats.
