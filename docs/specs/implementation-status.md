# Implementation Status

Consolidated view of what's done vs. planned. Check this before writing new specs or starting exploration.

For details on any item, see the linked spec file.

---

## Training Engine (`packages/training-engine`)

455 tests passing (Vitest). All specs implemented.

- [x] engine-001: 1RM formulas — Epley, grams↔kg helpers
- [x] engine-002: Cube method scheduler — blocks.ts
- [x] engine-003: Loading percentage calculator — set-calculator.ts
- [x] engine-004: Program generator — structural scaffold (no planned_sets)
- [x] engine-005: Performance adjuster — `suggestProgramAdjustments`, `DEFAULT_THRESHOLDS`
- [x] engine-006: MRV/MEV calculator
- [x] engine-007: JIT session generator — 8-step pipeline; `JITInput`/`JITOutput` types
- [x] engine-008: Auxiliary exercise rotator — `generateAuxiliaryAssignments`
- [x] engine-009: Soreness adjuster
- [x] engine-010: Warmup calculator
- [x] engine-011: LLM JIT generator — strategy interface, formula/LLM/registry in `generator/`
- [x] engine-012: Cycle review generator — `assemble-cycle-report.ts`, `cycle-review-generator.ts`
- [x] engine-013: Wilks 2020 formula — `formulas/wilks.ts`
- [x] engine-014: Menstrual cycle phase calculator — `formulas/cycle-phase.ts`
- [x] engine-015: Sex-differentiated formula config defaults
- [x] engine-016: Standard female warmup preset
- [x] engine-017: Sex-aware soreness adjuster — `getSorenessModifier` with `biologicalSex`
- [x] engine-018: Sex-differentiated performance thresholds — `DEFAULT_THRESHOLDS_FEMALE`
- [x] engine-019: Sex-aware auxiliary volume — `buildAuxiliaryWork` with `biologicalSex`
- [x] engine-020: `rest_seconds` in `FormulaConfig`; `JITOutput.restRecommendations`
- [x] engine-021: LLM rest suggestion — `restAdjustments` in `JITAdjustment`, ±60s clamp
- [x] engine-022: PR detection — `detectSessionPRs`, `computeStreak`, `checkCycleCompletion`
- [x] engine-023: Hybrid JIT generator — `hybrid-jit-generator.ts`, `comparisonData` on output
- [x] engine-024: Developer suggestions — `cycle-review.ts` extended; `developer_suggestions` table
- [x] engine-025: Multi-cycle context — `PreviousCycleSummary`, `getPreviousCycleSummaries`
- [x] engine-026: Unending session generator — `nextUnendingSession()` pure function; lift rotation, block cycling, deload cadence
- [x] engine-027: JIT volume augmentation — `buildVolumeTopUp()` in `jit-session-generator.ts`; `JITInput.auxiliaryPool`/`allOneRmKg`; `AuxiliaryWork.isTopUp`/`.topUpReason`; app caller merges all 3 lift pools + passes all 3 lift 1RMs; cross-lift top-up uses correct 1RM via `getLiftForExercise()`; UI shows "Volume top-up" divider + reason subtitle; MEV pro-rated by week progress; 24 tests
- [x] engine-028: Readiness adjuster — `getReadinessModifier(sleep, energy)` in `adjustments/readiness-adjuster.ts`; applied at JIT Step 2b; 9 tests
- [x] engine-029: Fatigue predictor — `computePredictedFatigue`, `detectMismatches` in `volume/fatigue-predictor.ts`; mismatch threshold ≥2 levels; sorted by delta; 9 tests
- [x] engine-030: Cycle phase JIT adjuster — `getCyclePhaseModifier(phase)` in `adjustments/cycle-phase-adjuster.ts`; applied at JIT Step 2c; McNulty 2020 phase lookup; 6 tests
- [x] engine-bug-001: Exercise type system — `auxiliary/exercise-types.ts`; `ExerciseType` (`weighted`/`bodyweight`/`timed`); `AuxiliaryWork.exerciseType`; timed exercises skip MRV; bodyweight sets `weight_kg: 0`

---

## Shared Types (`packages/shared-types`)

- [x] types-001: Zod schemas — all domain types
- [x] `formula.schema.ts` — `FormulaOverridesSchema`, `CreateFormulaConfigSchema`
- [x] `disruption.schema.ts` — `CreateDisruption`, `TrainingDisruption`, `DisruptionWithSuggestions`
- [x] `jit.schema.ts` — `JITAdjustmentSchema`, `JITAdjustment`
- [x] `cycle-review.schema.ts` — `CycleReviewSchema`, `CycleReview`
- [x] `challenge.schema.ts` — `JudgeReviewSchema`, `JudgeReview`, `DecisionReplaySchema`, `DecisionReplay`

---

## Infrastructure

- [x] infra-001: Nx 22.5.2 monorepo — apps/parakeet (Expo SDK 54), packages
- [x] infra-003: Supabase client — `platform/supabase/supabase-client.ts`
- [x] infra-004: EAS + GitHub Actions CI/CD
- [x] infra-005: Initial DB schema migration
- [x] ai-001: Vercel AI SDK — `training-engine/src/ai/` (models, prompts, constraints)

---

## Database Migrations (`supabase/migrations/`)

- [x] 20260223000000: Initial schema
- [x] 20260227000000: `rest_configs` table
- [x] 20260228000000: `personal_records` table
- [x] 20260229000000: `developer_suggestions` table
- [x] 20260301000000: `jit_comparison_logs` table
- [x] 20260304000000: `cycle_tracking` table + `session_logs.cycle_phase` column
- [x] 20260307000000: `programs.program_mode`, `programs.unending_session_counter`; `programs.total_weeks` nullable
- [x] 20260312000000: Fix developer_suggestions insert RLS; full initial schema re-applied
- [x] 20260312000001: Unending program mode columns
- [x] 20260313000000: `motivational_message_logs` table
- [x] 20260314000000: `sessions.program_id` nullable; `'import'` added to `intensity_type` constraint
- [x] 20260308000000: Free-form ad-hoc — `primary_lift` nullable, `intensity_type` nullable, `activity_name` column
- [x] 20260318000000: `weekly_body_reviews` table (engine-029 data store)
- [x] 20260321000000: `challenge_reviews` + `decision_replay_logs` tables (LLM challenge mode)

---

## App Modules (`apps/parakeet/src/modules/`)

Module/platform/shared architecture is the canonical app structure. Legacy top-level folders removed.

- [x] `@modules/auth` — sign-in, Google OAuth, email OTP
- [x] `@modules/program` — active program, maxes, auxiliary config, formula config, block number utils
- [x] `@modules/session` — lifecycle, JIT trigger, rest timer, sync, missed reconciliation, motivational message, session sorting
- [x] `@modules/jit` — JIT generation strategies
- [x] `@modules/history` — performance trends, lift history, chart data builders, trend presentation
- [x] `@modules/disruptions` — report/apply/resolve disruptions, severity inference, menstrual preset
- [x] `@modules/cycle-review` — post-cycle analysis, LLM report, developer suggestions
- [x] `@modules/cycle-tracking` — menstrual cycle config, phase calculation, shared phase presentation constants
- [x] `@modules/settings` — rest prefs, warmup config, JIT strategy, developer suggestions UI
- [x] `@modules/achievements` — PRs, streaks, Wilks badges
- [x] `@modules/training-volume` — weekly volume, MRV/MEV config, volume threshold classification
- [x] `@modules/formula` — formula config CRUD, draft-to-overrides transformer
- [x] `@modules/wilks` — Wilks score
- [x] `@modules/profile` — athlete profile CRUD

---

## Mobile Screens (`apps/parakeet/src/app/`)

- [x] mobile-001: Layout — `_layout.tsx`, tab nav
- [x] mobile-002: Auth flow — `welcome.tsx`
- [x] mobile-003: Onboarding — lift maxes, program settings, review
- [x] mobile-004: Today screen — workout card, volume card, disruption banners, streak pill
- [x] mobile-005: Session logging — `[sessionId].tsx`, `complete.tsx`, rest timer modal
- [x] mobile-006: Program view — week/block grid
- [x] mobile-007: Formula editor — block tabs, inline edit, history, AI suggestions
- [x] mobile-008: React Query hooks — Supabase client setup
- [x] mobile-010: Disruption report — multi-step form + adjustment review
- [x] mobile-011: Soreness check-in — `session/soreness.tsx`
- [x] mobile-012: Volume dashboard — full screen + compact card on Today
- [x] mobile-013: Warmup display — `WarmupSection` component
- [x] mobile-014: Cycle review shell — `history/cycle-review/[programId].tsx`
- [x] mobile-015: Cycle tracking settings — toggle, cycle length, date picker, phase calendar
- [x] mobile-016: Cycle phase UI — Today pill, history phase tag, cycle patterns screen
- [x] mobile-017: Rest timer — `RestTimer` component + modal in session screen
- [x] mobile-018: Rest timer settings — `settings/rest-timer.tsx`
- [x] mobile-019: Achievements screen — star cards, streak pill, Wilks score
- [x] mobile-020: History screen — trends + sessions + archived programs
- [x] mobile-021: In-session history — `LiftHistorySheet` opened via route param
- [x] mobile-022: In-session mini history sheet spec
- [x] mobile-023: Rest expiry haptics while browsing — `detectOvertimeEdge`
- [x] mobile-024: Rest done background notification
- [x] mobile-025: Barbell plate calculator
- [x] mobile-026: History tab upgrade
- [x] mobile-028: Unending program UI — Program Style toggle (onboarding), program tab unending branch, "End Program" global rename; next-session formula estimate card (weight, sets×reps, RPE, last-RPE adjustment hint)
- [x] mobile-029: Motivational message — LLM-generated post-workout message on WorkoutDoneCard; context-aware (RPE, PRs, streak, sex, cycle phase); multiple-sessions-per-day consolidated into single card
- [x] mobile-030: Ad-hoc auxiliary exercises — "+ Add Exercise" modal + "+ Set" button; `addAdHocSet` store action; resume recovery from persisted store
- [x] mobile-031: Bar weight setting — 15/20 kg toggle in Settings › Training; propagated to warmup floors, recovery mode floors, WarmupSection display label, PlateCalculatorSheet (unified AsyncStorage key `bar_weight_kg`); engine params default to 20
- [x] mobile-032: Ad-hoc workouts — `session/adhoc.tsx`; `createAdHocSession` service; JIT adapted for null program_id; "Ad-Hoc Workout" button on Today screen; WorkoutCard shows "Ad-Hoc Workout" label. See `sessions-008-adhoc-workouts.md`.
- [x] mobile-034: Free-form ad-hoc — `primary_lift`/`intensity_type` nullable; `activity_name` column; ad-hoc screen simplified to name input; session screen handles freeForm param (no JIT/soreness); complete allows aux-only; WorkoutCard routes directly to session screen for free-form
- [x] mobile-035: Enhanced readiness check-in — expanded soreness.tsx with "Other muscles" collapsible (all 9), sleep/energy pills, cycle phase informational chip; sleep/energy passed to JIT; ratings stored in `soreness_checkins.ratings` JSONB
- [x] mobile-036: Weekly body review — `session/weekly-review.tsx`; triggered on end-of-week (scheduled) or every 3rd session (unending); mismatch summary with direction arrows and MRV suggestion
- [x] mobile-033: Feature flags — `modules/feature-flags/` module with registry, AsyncStorage persistence, `useFeatureEnabled` hook. Settings › Features screen with Simple/Full presets and per-feature toggles. 16 toggleable features across 5 categories. Gates applied to Today screen and Settings screen.

---

## Data / Settings Screens

- [x] data-001: Volume config — `settings/volume-config.tsx` (9 muscle MEV/MRV steppers)
- [x] data-002: Auxiliary exercises — `settings/auxiliary-exercises.tsx` (pool reorder, lock)
- [x] data-003: Warmup protocol — `settings/warmup-protocol.tsx` (preset picker, custom steps)
- [x] data-004: Athlete profile — `profiles.biological_sex`, `profiles.date_of_birth`; onboarding wired
- [x] data-005: Cycle tracking — `cycle_tracking` table; `session_logs.cycle_phase`
- [x] data-006: Rest config — `rest_configs` table; per-lift rest overrides
- [x] data-007: Weekly body reviews — `weekly_body_reviews` table (migration 20260318000000); `modules/body-review` with `saveWeeklyBodyReview`, `getWeeklyBodyReviews`, `getLatestWeeklyReview`; `checkEndOfWeek` service function in session module
- [x] data-002 extension: Aux exercise muscle mapping — `getPrimaryMuscles()` in `@modules/program`; `reorderAuxiliaryPool` populates `primary_muscles`; muscle chips in `settings/auxiliary-exercises.tsx`
- [x] data-002 extension: Aux exercise type UI — `SetRow` `exerciseType` prop; bodyweight hides weight; timed shows mark-complete only
- [x] data-002 bugfix: Block assignment UX — `SlotPicker` (arrow scroller) replaced with `SlotDropdown` (tap trigger → bottom-sheet modal with search + FlatList); `MuscleChips` extracted to `components/settings/MuscleChips.tsx`
- [x] data-002 extension: Exercise catalog — `EXERCISE_CATALOG` in `exercise-catalog.ts` as single source of truth; `DEFAULT_AUXILIARY_POOLS` derived from catalog; `getAllExercises()`, `getPrimaryMusclesForExercise()`, `getLiftForExercise()` exported; 53 entries (6 squat, 9 bench, 11 deadlift, 27 general/bodyweight); pool cull removed inappropriate exercises (Olympic complexes, conditioning work, arm isolation in wrong pool)
- [x] data-002 extension: Add Exercise Modal context — `defaultLift` pre-filters to relevant lift section; `excludeNames` greys out already-pooled exercises; horizontal filter pills (All/Squat/Bench/Deadlift/General); settings screen passes `lift` + `pool` to the modal
- [x] data-002 bugfix: Settings screen — dirty indicator on Save Pool button; empty pool state; BW badge for bodyweight exercises; stale assignment validation when exercise is removed from pool; `activeProgram` query key canonicalized to `qk.program.active`

---

## Program Modes

- [x] programs-005: Unending program mode — `program_mode`, `unending_session_counter`, lazy session generation, cycle review on "End Program"; orchestration in `program/application/unending-session.ts`; multiple-workouts-per-day fix; cycle badge suppression for unending

---

## Refactors

- [x] refactor-001: Extract business logic from React components — domain logic moved to training-engine and module utils; presentation constants consolidated. See below for details.
  - `getPhaseForDay` → `training-engine/formulas/cycle-phase.ts` (removed duplicate from settings/cycle-tracking)
  - `estimateWorkingWeight` → `training-engine/formulas/weight-rounding.ts` (removed `WORKING_PCT` from settings/warmup-protocol)
  - `currentBlockNumber`, `unendingBlockNumber` → `modules/program/utils/program-utils.ts`
  - `classifyVolumeLevel`, `getMrvWarningMuscles` → `modules/training-volume/utils/volume-thresholds.ts`
  - `toRowDraft`, `initDraft`, `draftToOverrides`, `exampleWeight` → `modules/formula/lib/formula-draft.ts`
  - `SORENESS_NUMERIC`, `inferEffectiveSeverity`, `getMenstrualSymptomsPreset` → `modules/disruptions/lib/disruption-presets.ts`
  - `partitionTodaySessions` → `modules/session/utils/session-sorting.ts`
  - `buildVolumeChartData` → `modules/history/utils/chart-helpers.ts`
  - `CYCLE_PHASE_LABELS/BG/TEXT` → `modules/cycle-tracking/ui/cycle-phase-styles.ts` (consolidated from 4 files)
  - `TREND_CONFIG` → `modules/history/ui/trend-styles.ts` (consolidated from 2 files)

---

## Dashboard (`apps/dashboard`)

- [x] Timeline view (all AI events)
- [x] JIT sessions view
- [x] Workout Summaries view — completed sessions with RPE, PRs, performance vs plan, completion %
- [x] Hybrid comparisons view
- [x] Cycle reviews view
- [x] Formula suggestions view
- [x] Developer suggestions view
- [x] Challenge Reviews view — post-hoc JIT judge scores + concerns
- [x] Decision Replay view — retrospective prescription accuracy scores

---

## Scripts (`scripts/`)

- [x] `scripts/import-csv.ts` — historical CSV import CLI; auto-detects NextSet and Strong formats; interactive exercise mapping; inserts sessions with `program_id=null` and `intensity_type='import'`

---

## Bug Fixes

- [x] Disruption skip — skipped/missed sessions in program grid now show "Skipped"/"Missed" pill badges (previously only a red dot, no text label) — `SessionSummary.tsx`
- [x] Disruption skip — `handleApply()` now invalidates `program.active` + `session.today` queries so the program grid refreshes immediately after adjustment is applied — `report.tsx`

---

## Planned / Future

### 4-Day Programs with Overhead Press — [design doc](../design/four-day-ohp.md)

- [ ] types-002: Add `overhead_press` to Lift enum
- [ ] engine-031: 4-lift cube rotation
- [ ] engine-032: OHP formula config defaults
- [ ] engine-033: OHP auxiliary exercise catalog
- [ ] engine-034: OHP muscle mapping for primary lift volume
- [ ] mobile-037: Conditional OHP max collection in onboarding
- [ ] mobile-038: 3/4-day program creation selector
- [ ] data-008: OHP lifter maxes schema

### LLM Challenge Mode — [design doc](../design/llm-challenge-mode.md) | [spec](10-ai/ai-002-challenge-mode.md)

- [x] ai-002: Challenge mode — `JudgeReviewSchema`/`DecisionReplaySchema` in shared-types; `JUDGE_REVIEW_SYSTEM_PROMPT`/`DECISION_REPLAY_SYSTEM_PROMPT` in prompts.ts; `reviewJITDecision` + `scoreDecisionReplay` engine functions; `challenge_reviews` + `decision_replay_logs` DB tables; judge fires from `runJITForSession()` (fire-and-forget); replay fires from `completeSession()` (fire-and-forget); challenge banner on session screen; dashboard pages for both; `jit_input_snapshot` expanded to full JITInput; ai-overview.md updated with §10/§11

### Other

- [ ] Sleep data integration (wearables → JIT context)
- [ ] Health app integration for cycle tracking
- [ ] Multi-cycle pattern analysis for female lifters
