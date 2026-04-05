# AI Learnings

Reusable patterns discovered during implementation. Read on-demand when debugging, reviewing, or hitting a wall.

## Database & Schema

**Nullable schema columns cascade** — making a DB column nullable requires updating: the migration, `supabase/types.ts`, Zod schemas in `shared-types`, domain types in `shared/types/domain.ts`, and every call site that assumed the value was always present. Grep the column name across the full codebase before starting.

**Sentinel values need constraint updates** — when using a new enum-like value as a sentinel (e.g., `intensity_type = 'import'`), check whether the column has a DB CHECK constraint and update it in the same migration.

**Verify column names against migrations, not sibling query files** — always verify against the migration SQL. A silently wrong column name causes the query to return no data with no error thrown.

**Strip-then-insert patterns silently discard data** — when a field is stripped before a DB insert, make sure the filter happens _before_ the strip.

**Supabase nested selects have no guaranteed order** — `.select('*, sessions(...)')` returns joined rows in heap/UUID order, not by any column. Any code that uses `[0]`, `.find()`, or `.at(0)` on nested results is order-dependent and will produce random results. Either add `.order()` to the nested relation or sort in the consumer. Grep for `sessions[0]`, `sessions!inner`, and `.find(` on query results when reviewing.

**Relative shifts on DB values compound errors** — if code shifts a value relative to its current state (`startDate += delta`), prior bugs or multi-step operations can cause drift that's invisible to the current call. Always compute shifts from ground truth (e.g., `originalStart.getDay()`) rather than assuming the DB value is in the expected state.

## UI & Components

**Prop→state sync effects cause render cascades — use derived values instead** — when a component initializes local state from props (`useState(prop)`) and then syncs changes via `useEffect`, external updates create a cascade: prop changes → effect fires → sets state → `onUpdate` effect fires → parent re-renders. The fix is a pure function that resolves display values from both local state and props: when externally controlled (e.g., `isCompletedProp`), bypass local state entirely and return prop values. No sync effects needed, no cascading updates. See `resolveSetRowDisplay`.

**Data already in the DB is often already fetched but unused in the UI** — before adding new queries or columns for a feature, check if the data is already selected in existing queries. PR dates (`achieved_at`) were already fetched from `personal_records` but never threaded through to the display layer. The fix was 3 lines in the service and 5 in the component.

**Extract components at component boundaries** — the signal is "does this have its own `useState`?", not "is the file getting long?".

**Shared modals need context props, not duplication** — when the same modal is used in two contexts, the correct fix is props (`defaultLift`, `excludeNames`), not duplicating the component.

**Status indicators need both a dot and a text label** — if a user would need to remember a colour legend, add a label.

**Repeated style tokens drift — extract a shared component** — when 15+ screens each define the same title style inline, some will use raw values (24px/800) while newer ones use theme tokens (2xl/black). The fix is a shared component (`ScreenTitle`) that owns the canonical style, not find-and-replace on raw values. The component prevents future drift because new screens import it instead of copying a style object.

## Engine & Domain Logic

**Default params over guard clauses for backward-compatible changes** — use default arguments (`barWeightKg = 20`) rather than null checks. Keeps all existing call sites passing.

**Check all sibling files implementing the same interface** — when adding a required field to a shared interface, grep for all files that construct that type, not just the primary one.

**Sub-function caps don't prevent overflow at the aggregation layer** — if multiple sub-functions append to the same output list, enforce the combined size limit at the call site, not inside individual contributors.

**Domain semantics can eliminate UI steps** — "failed set = RPE 10 by definition" removes the RPE picker for failed sets. Before adding UI for user input, ask: does the domain already determine this value?

**Distinguish base value errors from modifier errors** — when a computed result is wrong, the fix depends on which layer is incorrect. If the base input is stale (e.g., stored 1RM hasn't updated), fix the base — don't add a compensating modifier on top of other modifiers. Modifiers handle daily conditions (soreness, readiness); a stale baseline is a different class of error. Adding `weight_history` as a modifier would compound with existing modifiers and double-count the correction. Instead, compute a "working value" that replaces the base when confidence is sufficient, and record both stored and working values in the trace for observability.

**Step functions on continuous scales create cliff effects** — the RPE scaler used `if (rpe < 7) return 0.15; if (rpe < 8) return 0.65`, creating a 4.3× jump at RPE 7.0. An entire session at RPE 6.5 counted as 11% of MEV. Half-point RPEs are extremely common in practice. When modelling a continuous input (RPE, soreness, readiness) with discrete breakpoints, use piecewise linear interpolation between anchors instead of step functions. The anchors document the design intent; the interpolation prevents cliffs at boundaries.

**Intensity and volume are independent failure modes** — when a session produces low effective volume, diagnose which lever is wrong before applying a fix. Volume calibration (#117) adds sets, but more sets at the wrong weight = more sets at 0.15 multiplier = still negligible. Weight autoregulation fixes the intensity; volume calibration fixes the count. Applying the wrong lever wastes development effort and delays resolution. Pattern: identify the failure dimension (volume vs intensity vs frequency) before designing the solution.

**Auto-selection from cross-lift pools must be schedule-aware** — `buildVolumeTopUp` selects exercises purely by MEV deficit, ignoring upcoming lifts. This causes back-to-back muscle group loading (e.g., leg press on bench day before squat day). Fix: pass `upcomingLifts` and filter out exercises whose associated lift is scheduled later this week. Pattern: any auto-selection system drawing from a cross-lift pool must consider the training schedule, not just the deficit.

## Refactoring

**Pipeline extraction preserves behavior when mutable context is threaded** — a 400-line function with 9 sequential steps sharing mutable local variables (`intensityMultiplier`, `plannedCount`, `skippedMainLift`) can be safely extracted by creating a `PipelineContext` interface that captures all shared state. Each step function mutates the context in place, matching the original code's mutation pattern. The main function becomes a clean pipeline of named steps. Key: run the full test suite after each step extraction to catch subtle ordering or reference bugs.

**Inline conversions drift — extract named helpers** — `Math.round(kg * 1000)` appeared in 7+ files for kg→grams conversion. Each site is a copy-paste that can independently get the rounding wrong. A single `weightKgToGrams(kg)` helper is safer and communicates intent. Same for the reverse direction. The mechanical find-and-replace is low risk when the helper's implementation exactly matches the original expression.

**Split aux/main branches before adding behavior** — `handleLiftComplete` and `handleLiftFailed` each contain parallel aux/main code paths behind an if/else. When the two paths share no state except the dismiss result, extracting `handleMainLiftComplete` and `handleAuxLiftComplete` as separate functions makes the dispatch obvious and prevents changes to one path from accidentally affecting the other. This also makes the "symmetry check" from the ai-learnings stubs-ship-as-bugs entry trivially visible — each function is self-contained.

**Re-exports don't create local bindings** — `export { MuscleGroup } from '@parakeet/shared-types'` makes `MuscleGroup` available to importers of the file, but NOT usable within the same file. If the file also uses `MuscleGroup` locally (e.g., `Record<MuscleGroup, ...>`), you need a separate `import type { MuscleGroup } from '@parakeet/shared-types'` alongside the re-export. The engine's own `tsc` may pass (if it resolves the import differently) while the app's `tsc` fails — so always validate from the app's tsconfig after moving types across packages.

**Run format and lint after every change** — `npx nx lint parakeet` (oxlint) catches unused vars/imports; `npx nx format parakeet` (Prettier with `@ianvs/prettier-plugin-sort-imports`) fixes import ordering. These are separate tools: lint detects problems, format fixes style. Import ordering is Prettier's job, not oxlint's. Run both after modifying imports or refactoring.

## Architecture & Workflow

**Native Expo packages must be in the app's `package.json`, not just the root** — in an Nx monorepo, `expo-modules-autolinking` scans `apps/parakeet/package.json` dependencies to decide which native modules to link. A package installed only in the root `package.json` will be resolvable by Node (hoisted `node_modules/`) and pass TypeScript checks, but autolinking won't see it — the native module won't be included in the build, causing a runtime crash (`Cannot find native module 'Expo...'`). Always add native Expo packages to both the root (for hoisting) and `apps/parakeet/package.json` (for autolinking).

**Design ceremony proportional to scope** — new architectural concepts warrant design doc > spec > implement. Simple UI additions can go straight to implement > spec after. One-time admin operations are CLI scripts, not mobile screens.

**Lazy generation pattern for unending modes** — check for an existing record first, then generate only if missing. Never generate unconditionally.

**Audit all mode-unaware code paths when adding a new program mode** — grep for every place that makes a completion-percentage or session-count decision. Achievement detection, notification logic, and "show completed session" queries are all candidates.

**Update docs after, to match reality** — the plan captures intent; the spec captures what was actually built. Always re-read the actual code before writing the final spec.

**Main/aux symmetry in session flow** — `handleLiftComplete` and `handleLiftFailed` each have a main-lift branch and an aux branch. When modifying one branch (e.g., fleshing out main-lift failure handling), always check the parallel branch in the same function AND the equivalent function. The intra-session adaptation commit added full failure handling for main lifts but left the aux failure branch as a rest-only stub — the same pattern that `handleLiftComplete` already handled correctly for aux. Review checklist: if you touch `handleLiftComplete` main → check `handleLiftComplete` aux, `handleLiftFailed` main, `handleLiftFailed` aux.

**Stubs ship as bugs** — a stub that "just logs rest" or returns a default is invisible at review time but breaks the feature for users. If a code path can be reached by a user action, implement it fully or throw an error so it's caught immediately. The aux failure branch in `handleLiftFailed` was left as a rest-only stub with a comment ("just log rest, no main-lift adaptation") — it silently ate user input for months. If you can't implement a path yet, make it fail loudly (`throw new Error('not yet implemented')`) so it surfaces in testing rather than shipping as silent data loss.

**Don't overload state that downstream handlers interpret with arithmetic** — `PostRestState.pendingAuxSetNumber` means "the set just completed" and downstream handlers do `+1` to get the next set. Reusing this state for a "confirmation of the current set" would cause an off-by-one where set 2 gets completed/failed instead of set 1. When existing dispatch handlers assume positional semantics (prev → next), introduce a dedicated state for a fundamentally different flow (confirm → then proceed) rather than adding boolean flags to reinterpret the same fields.

**Ad-hoc items bypass the planned-data array** — `handleAuxSetUpdate` looked up `exerciseType` only from JIT-generated `auxiliaryWork`. Ad-hoc exercises aren't in that array, so the lookup returned `undefined` and timed exercises got the weighted treatment. Pattern: any handler that derives behavior from a planned-data array must fall back to a canonical source (e.g., `getExerciseType()` from the catalog) for user-added items.

## Documentation

**Doc restructures have a long reference tail** — moving files from `docs/design/` and `docs/specs/` to `docs/features/` required fixing references in: CLAUDE.md, docs/README.md, docs/guide/ai-workflow.md, docs/guide/code-style.md, docs/decisions/, docs/prompts/, .claude/commands/, root README.md, and ~100 internal cross-references within the moved files themselves. The `.claude/commands/` files are highest priority since they direct agent behavior on every `/kickoff`, `/wrap-up`, `/finish`, and `/review` invocation. Always grep the full repo after bulk renames — don't assume "just docs" means the blast radius is small.

## Agent Patterns

**Feature requests often surface latent data bugs** — trace display problems back to the write path before adding view-layer filters.

**Bug reports are two-part: DB write path + UI refresh path** — check (1) did the write actually change the DB? and (2) did the UI query get invalidated? Missing cache invalidation is the most common cause of "stale UI" bugs.

**GH issues signal spec gaps, not just code bugs** — when a bug arrives, trace it back to the spec. Update the spec so the same gap can't reappear.

**Review the affected screen before writing new features** — a pre-implementation screen review catches issues that would otherwise ship alongside the new feature. Checklist: query keys match `qk.*`; mutations invalidate relevant queries; props flow context the child needs.

**Cross-component state changes need explicit validation** — removing an item from a list that is also referenced by sibling state silently leaves stale references. The change handler for the base state must validate and repair derived state.

**Weekly thresholds need pro-rating when checked per-session** — a weekly target compared against volume-to-date on session 1 of 3 will always show a deficit. Pro-rate: `ceil(target * sessionIndex / totalSessions)`.

**Lazy-generated data defeats DB queries for future state** — `fetchUpcomingSessionLifts` queried the DB for future sessions, but unending programs generate sessions lazily (only the current session exists). The query returned `[]`, so the upcoming lift protection was silently bypassed. Fix: derive future state from deterministic logic (the S→B→D rotation) instead of assuming the DB has it. Pattern: any feature that queries for "planned but not yet created" data must have a fallback for lazy-generation modes.

**Scale migration: avoid normalise-in-the-middle** — when widening a scale (1-5 → 1-10), a `normalise()` function that doubles values <= 5 seems backwards-compatible but creates a non-monotonic trap: UI value 5 gets doubled to 10 (severe) while UI value 6 stays at 6 (moderate). If the UI already sends the new scale, remove the normaliser entirely and update all thresholds + tests to the new scale. The normaliser pattern only works if old-scale callers are isolated (e.g. DB migration boundary) — never in the hot path where both old and new values can arrive.

**Automatic overrides must check for explicit user config first** — a `workingWeight < 40 → minimal warmup` heuristic silently discarded an explicit `empty_bar` choice for bench. When adding automatic overrides to any user-configurable value, always thread an `explicit` flag from the data layer (where DB row presence is known) and skip the override when the user has actively chosen a setting. The heuristic should only apply to defaults.

**Cross-strategy behavior must live in shared helpers, not inline in one path** — the formula JIT path had warmup override logic (recovery mode, low weight) that the LLM and constraint-enforcement paths lacked entirely. Any behavior that should apply "regardless of JIT strategy" must be extracted into a shared pure function and called from all code paths. Pattern: when adding logic to the formula path, grep for the equivalent code in `llm-jit-generator.ts` and `jit-constraints.ts`.

**Adaptive systems need both proactive and reactive mechanisms** — the JIT pipeline originally had 7 reduction mechanisms but zero proactive volume increase. Volume recovery (reactive, intra-session) isn't enough — the system also needs volume calibration (proactive, pre-session, based on accumulated evidence). When designing modifier systems, always ask: "can this signal increase the prescription, not just decrease it?"

**Mirrored domain functions must share a consistency test** — when a new function (`computeVolumeBreakdown`) mirrors an existing one (`computeWeeklyVolume`) but with richer output, add an invariant test asserting their totals match for all inputs. This catches drift if either function's logic changes independently.

## Testing

**Tautological tests catch nothing** — `expect(CONSTANT.field).toBe(3)` tests that a constant equals itself. Replace with behavioral tests.

**Invariant tests catch classes of bugs point tests miss** — identify properties that must hold for ALL valid inputs, build a combinatorial matrix, assert the property.

**Compound interaction tests catch pipeline ordering bugs** — individual adjuster tests pass, but the pipeline applies them in sequence. Test with 3-4 adjusters active simultaneously.

**Scenario tests are the ultimate intent tests** — "beginner female, menstrual phase, first heavy squat" exercises the full pipeline with realistic inputs.

**Shared test fixtures reduce copy-drift** — extract `baseInput()`, `makeDisruption()`, `makeSets()` to `__test-helpers__/fixtures.ts`.

**Auxiliary weight prescriptions need prod data validation** — catalog `weightPct` values set from theory (percentage of associated lift 1RM) were ~2× too high for machine/cable exercises (Lat Pulldown, Seated Row). Machine movements eliminate stabilizer recruitment, so strength doesn't transfer 1:1 from barbell lifts. Fix: halved machine `weightPct` values based on actual user loading data. Pattern: any new `weightPct` should be validated against real session data within the first training cycle.

**Compound aux after heavy main needs a fatigue discount** — `processAuxExercise` treated each aux exercise as if the main lift never happened. Prod data showed RPE 9.5-10 cascades on compound auxiliaries sharing muscles with the primary lift (e.g., CGBP after bench). A 15% fatigue discount (`POST_MAIN_FATIGUE_FACTOR = 0.85`) for muscle-overlapping aux exercises aligns with observed outcomes. The discount stacks multiplicatively with soreness modifiers.

**Session RPE exceeding main lift RPE signals aux overexertion** — when `session_rpe - avg_main_lift_rpe > 1.0`, the auxiliary work is the primary overexertion driver, not the main lift. This gap is a reliable diagnostic for aux prescription accuracy and should be monitored.

**Store explicit failure flags, not just RPE 10** — inferring failures from RPE 10 + low reps loses the explicit user signal. Adding `failed: true` to the JSONB when the user taps "Failed" enables direct failure-rate analysis without heuristics.

**Test fixtures must match the signal path being tested** — when changing `rep-detector.ts` from Y-coordinate to joint-angle detection, the bench fixtures didn't move elbows (only wrists). The angle signal was flat, so the fallback path fired silently. Fixtures need to produce realistic oscillation in whatever signal the algorithm uses. Always verify that the NEW code path is actually being exercised by checking that the fallback doesn't fire.

**Perspective correction direction: divide, not multiply** — when compensating for foreshortened measurements at oblique camera angles, the measured value is *smaller* than reality, so the correction must *increase* the value (divide by the foreshortening factor). Multiplying by `sqrt(confidence)` makes already-small values even smaller — the opposite of what's needed. For angular metrics with natural caps (e.g., forward lean maxes at 90°), clamp after correction to avoid exceeding the geometric bound.

**Binary classifications on continuous inputs create silent failure cliffs** — the `'side' | 'front'` camera angle classification using a hard threshold on shoulder separation failed at every intermediate angle (~30-60°, which is the majority of real gym videos). Replacing with a continuous 0-1 confidence score eliminates the cliff: all metrics always computed, severity and precision scale with confidence, and there's no "wrong" camera position. Pattern: whenever a system classifies a continuous input into two buckets and the response differs significantly between buckets, the boundary will be a source of bugs. Use a continuous signal instead.

### UX & Information Display

**Multiple display sites for the same data need a single resolver** — when three UI components (SetRow, rest timer label, post-rest overlay) each independently read `plannedSets[index]` to show the same weight/reps, they diverge the moment a transformation layer (intra-session adaptation) applies to only one path. The fix isn't to add the transformation to each site — it's to extract a single `getEffectivePlannedSet(index, ...)` function that all sites call. Pattern: if the same domain data appears in 2+ places with different formatting, add a shared resolver at the data layer, not inline lookups at each display site.

**Stacked overlays need information density budgeting** — when two overlay cards (RPE picker + rest timer) are visible simultaneously, the combined height can consume ~77% of an iPhone SE screen. Suppress secondary context (e.g., "next lift" label in the timer) while the primary action (RPE entry) is pending. Only show lookahead information after the immediate action is resolved.

**Context labels should support, not compete with, action buttons** — when adding informational labels near interactive elements, use a lower visual weight (medium/textSecondary) so the label provides context without competing for attention. The action buttons should always be the most visually prominent elements.

**Zero-weight edge case in display labels** — bodyweight exercises store `weight_grams: 0`. Any label that formats `${kg}kg × ${reps}` must handle the 0kg case — omit the weight portion entirely rather than showing "0kg". Check `exerciseType` or `weight_grams === 0` before formatting.

**Exercise type suppression has multiple paths** — when adding behavior that differs by exercise type (e.g., suppress RPE for bodyweight), trace *all* code paths that trigger the behavior. In `useSetCompletionFlow`, there are 5 distinct paths that open a rest timer or prompt RPE: `handleAuxSetUpdate`, `handleAuxLiftComplete`, `handleAuxConfirmComplete`, `handleAuxConfirmFailed`, and `SetRow` rendering. Missing even one path creates inconsistent UX. Search for the *effect* being suppressed (e.g., `setPendingAuxRpe`, `openTimer`) across the entire file.

**Feature touchpoints in screens must be self-contained module exports** — when a new feature adds UI to existing screens (`app/`), never inline the feature's logic, styles, flag checks, or routing into the screen. Instead, export a single self-contained component from the module (e.g., `<VideoEntryButton>`) that owns everything: feature flag gate (renders null when disabled), routing, styles, accessibility. The screen passes props (IDs, data) and renders one line. This was missed during video form analysis — the agents added inline `TouchableOpacity` + `router.push` + `useFeatureEnabled` + emoji text + styles directly into `[sessionId].tsx` and `history/[sessionId].tsx`. The fix was trivial but the miss was preventable: task prompts should say "export a component from the module" not "add a button to the screen."

**"vs plan" is meaningless when the plan is always personalized** — JIT generates a plan adjusted for soreness, disruptions, readiness, and cycle phase. Comparing actual vs adjusted always yields ~100%. Users interpret "on plan" as "on the original schedule" not "on the adjusted plan." Fix: show adjustment context (what changed and why) instead of a misleading percentage. Surface `JITOutput.volumeReductions` and `rationale` alongside completion stats.

### Native Module Integration

**Analyze before compress, not after** — when processing video through a CV pipeline, run analysis on the uncompressed source. Compression introduces artifacts that degrade pose detection accuracy. The compression step is for storage, not for the analysis input. Pipeline: pick → analyze (raw) → compress (for storage) → save.

**expo-video-thumbnails bridges SharedRef gap** — `expo-video.generateThumbnailsAsync` returns `SharedRef<'image'>` which is not a file path. `PoseDetectionOnImage` from `react-native-mediapipe` requires a file path string. `expo-video-thumbnails.getThumbnailAsync` returns `{ uri: string }` — a real file URI. Use the older package for frame extraction when the consumer needs file paths.

**MediaPipe model goes in Android assets via config plugin** — `react-native-mediapipe` loads models via `BaseOptions.setModelAssetPath()` which reads from the Android APK's `assets/` directory. In an Expo project, create a config plugin (`withDangerousMod`) that copies the `.task` model file to `android/app/src/main/assets/` during prebuild. Reference it by filename only (`"pose_landmarker_full.task"`), not by path.

**Native deps need both root + app package.json** — in an Nx monorepo with Expo, `expo-modules-autolinking` scans `apps/parakeet/package.json` only. A package in just the root `package.json` passes TypeScript but crashes at runtime. Always add native packages to both.

**Schema fields silently dropped when computed but not in Zod schema** — `satisfies` allows excess properties from intermediate computations (e.g., `.map()` return types). If `metrics-assembler.ts` produces `kneeAngleDeg` and `hipAngleAtLockoutDeg` but `RepAnalysisSchema` doesn't include them, the fields persist in the JSONB column but are invisible to typed consumers. When adding computed fields, update the schema in the same commit.

**Decouple CV extraction from analysis for testability** — `analyzeVideoFrames(frames, fps, lift)` takes pre-extracted `PoseFrame[]`, making it trivially testable with synthetic data and completely decoupled from the native CV backend. The extraction function (`extractFramesFromVideo`) is integration-test territory. This boundary (pure analysis vs native extraction) enables 100 unit tests without mocking native modules.

**Sequential frame processing avoids GPU contention** — processing frames sequentially through `PoseDetectionOnImage` (one at a time) is simpler and avoids overwhelming the GPU delegate. A 30s video at 15fps = 450 frames × ~10-30ms each = 5-15s total. Parallel processing would risk thermal throttling and memory pressure on mobile devices.

**Type casts are deferred bugs, not solutions** — when a function needs `as any` or `as unknown as X` to compile, the type system is telling you something is wrong upstream. Every `as any` cast in Phase 1 (`typedSupabase as any`, hand-written `SessionVideoRow`) survived through Phase 2, 3, and 4 because each phase built on the broken foundation instead of fixing it. By Phase 4, there were 5+ files with hand-written types and `as any` casts that should have been one `npm run db:types` command. Pattern: when you hit a type error, fix the source (regenerate types, push migrations, fix the interface) before writing the code that depends on it. Never defer this — compounding type debt is invisible until it causes a runtime failure.

**Barrel exports leak implementation details when they include repository functions** — exporting `insertSessionVideo`, `getVideoForSessionLift`, `deleteSessionVideo` from `index.ts` invites external callers to bypass hook orchestration, cache management, and error handling. The public API of a module is its hooks and UI components. Repository functions are internal — consumed by the module's own hooks, not by screens or other modules. When building a new module, start the barrel with hooks + UI + types, and never add repository functions.

**Empty landmark frames maintain index alignment** — when MediaPipe fails to detect a pose in a frame (occlusion, blur), push a zeroed 33-landmark frame to maintain frame index alignment. The rep detector and angle calculator reference frames by index — skipping frames would misalign the temporal data. Zeroed visibility values let downstream code ignore these frames gracefully.
