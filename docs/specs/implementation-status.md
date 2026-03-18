# Implementation Status

Consolidated view of what's done vs. planned. Check this before writing new specs or starting exploration.

For details on any item, see the linked spec file.

---

## Training Engine (`packages/training-engine`)

1013 tests passing (Vitest). All specs implemented. Bug fix: `generateAuxiliaryAssignments` now generates assignments for all blocks (not just 1–3); `blockNumber` widened to `number` throughout; `getIntensityTypeForWeek` now cycles correctly for block 4+.

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
- [x] engine-031: Push muscle coverage boost — `buildVolumeTopUp()` bypasses MEV pro-rating for chest/triceps/shoulders when `primaryLiftContrib === 0`; ensures push volume fires on squat/deadlift days; bench day unaffected (`contrib > 0`); 4 tests
- [x] engine-bug-001: Exercise type system — `auxiliary/exercise-types.ts`; `ExerciseType` (`weighted`/`bodyweight`/`timed`); `AuxiliaryWork.exerciseType`; timed exercises skip MRV; bodyweight sets `weight_kg: 0`
- [x] engine-bug-002: No-equipment session exercise cap — `MAX_AUX_EXERCISES = 5` guard before pushing top-ups in `generateJITSession`; prevents no-equipment + volume top-up from combining to 6+ aux exercises; 1 regression test added
- [x] engine-bug-003: Auxiliary rotator block 4+ gap — `generateAuxiliaryAssignments` now generates assignments for all blocks (not just 1–3); `blockNumber` widened to `number` throughout; `getIntensityTypeForWeek` cycles correctly for block 4+ via mod-3 arithmetic
- [x] engine-bug-004: Dumbbell/kettlebell weight scaling (GH#84) — `computeAuxWeight()` in `exercise-catalog.ts`; sqrt scaling for exercises starting with "Dumbbell"/"Kettlebell" replaces linear `1RM × weightPct`; sex-aware `SQRT_REFERENCE_1RM` per lift (squat 120/70, bench 80/50, deadlift 140/80); corrected `weightPct` for DB Incline (0.30→0.28), DB Snatch (0.30→0.21), KB Swing (0.15→0.20), KB Deadlift (0.15→0.20); 3 call sites updated (formula, LLM, volume top-up); 6 new tests
- [x] engine-041: Modifier effectiveness tracker — `computeCalibrationBias`, `shouldTriggerReview`, `canAutoApply`, `extractModifierSamples`, `applyCalibrationAdjustment` in `analysis/modifier-effectiveness.ts`; confidence thresholds (exploring/low/medium/high); auto-apply for small adjustments, LLM review gate for large ones; 25 tests
- [x] engine-040: Prescription trace — `PrescriptionTrace` type + `PrescriptionTraceBuilder` class; `generateJITSessionWithTrace(input)` wrapper; traces weight derivation (1RM × blockPct × modifiers), volume changes per adjuster, set details, auxiliaries, warmup, rest; 16 tests. App plumbing: trace generated in `jit.ts`, persisted to `sessions.jit_output_trace` JSONB, cached in Zustand store. UI: `PrescriptionSheet` bottom sheet, ⓘ icon on SetRow, "Workout Reasoning" button on history detail; `prescriptionTrace` feature flag (advanced, default off)
- [x] engine-035: Training-age-scaled MRV/MEV — `TrainingAge` type, `TRAINING_AGE_MULTIPLIERS` constant, `applyTrainingAgeMultiplier({ config, trainingAge })` in `mrv-mev-calculator.ts`; beginner ×0.8 MRV, intermediate ×1.0, advanced ×1.2 MRV / ×1.1 MEV; wired into simulator; 5 tests

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
- [x] infra-006: Simulation CI improvements — 3 new life scripts (peaking, competition-prep, return-from-layoff; 14 total scenarios), `--output` flag for JSON artifacts, threshold tracking with `baseline.json`, CI uploads artifacts via `actions/upload-artifact@v4`
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
- [x] mobile-019: Achievements screen — star cards, streak pill, Wilks score; PR rows and fun badge rows link to triggering session via `/history/[sessionId]` (GH#88)
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
- [x] mobile-037: Rest timer auto-dismiss — PostRestOverlay with Complete/Failed/Reset 15s; set context label (set number, weight, reps); RPE cleared on timer→overlay transition; failed-reps-input mode (stepper, Confirm/Back); failed set marked complete with actual reps; RPE queued after failure
- [x] mobile-038: Context-aware aux suggestions (GH #82) — `AddExerciseModal` gets a "Suggested" section at top (hidden during search) with up to 5 exercises filtered to session's primary lift, sorted by uncovered muscles; `addAdHocSet` accepts `initialWeightGrams`; first set pre-filled with `1RM × catalog.weightPct` rounded to 500g; 0 for bodyweight/timed; modal auto-selects lift filter tab. Pure utils: `computeSuggestedAux`, `computeSuggestedWeight` in `modules/session/utils/aux-suggestions.ts`; 13 tests.
- [x] mobile-041: Planned vs actual in session detail (GH #86) — `history/[sessionId].tsx` shows "Plan" vs "Actual" columns (format: `kg×reps`) when `sessions.planned_sets` is present; actual values color-coded (green = over, red = under, default = at plan); falls back to original layout when no plan. `parsePlannedSetsJson` added to `modules/session/data/session-codecs.ts`, exported from `@modules/session`. No new queries.

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
- [x] data-002 bugfix: Block assignment tabs — `blockTabs` derived from `Math.ceil(total_weeks / 3)`; unending always `[1,2,3]`; block 4+ label uses cycled index for intensity label

---

## Program Modes

- [x] programs-005: Unending program mode — `program_mode`, `unending_session_counter`, lazy session generation, cycle review on "End Program"; orchestration in `program/application/unending-session.ts`; multiple-workouts-per-day fix; cycle badge suppression for unending; history-based lift rotation (last completed lift → next in squat→bench→deadlift cycle, counter-based fallback for first session)

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
- [x] Timed exercise logging UX (GH#81) — `SetRow.tsx` timed branch redesigned: "Round N" + duration input (min) instead of "Complete / as prescribed"; RPE picker and rest timer suppressed for timed exercises in `useSetCompletionFlow.handleAuxSetUpdate`; all 5 exercises (Row Machine, Ski Erg, Run - Treadmill/Outside, Toes to Bar, Plank) already existed in catalog — users add them via Settings › Auxiliary Exercises → General filter
- [x] History lift filter scope (GH#87) — lift filter chips moved above volume chart; `buildVolumeChartData` accepts optional `liftFilter` to show single-lift line; legend filters to active lift(s); filter still controls Recent Sessions list
- [x] Weekly review timing (GH#85) — removed immediate post-session review card from `complete.tsx`; `checkEndOfWeek` result now writes `pending_weekly_review` to AsyncStorage + schedules Saturday 10am push notification; `today.tsx` checks AsyncStorage on every focus and shows a "Weekly body check-in ready" nudge card when pending and not already submitted; "Review" clears AsyncStorage + navigates; "Later" hides for session but re-shows on next focus
- [x] Disruption-soreness compounding — JIT Step 5 no longer resets soreness/readiness adjustments when a disruption is active; takes `min()` per dimension (sets, intensity) so both signals compound conservatively; major disruptions still skip entirely; 2 new tests + 1 updated; soreness screen shows active disruption context banner; LLM prompt updated to reason about disruption-sourced soreness
- [x] Weight carry-forward — PostRestOverlay "Complete" pre-fills next set with the user's actual weight from the last completed set (not the planned weight); applies to both main and auxiliary sets; `useSetCompletionFlow.ts`
- [x] Plate calculator discoverability — icon size 16→20, touch target 28×28→36×36 in `SetRow.tsx`
- [x] Plate availability persistence (GH#91) — `handleDisabledPlatesChange` and `handleBarWeightChange` in `[sessionId].tsx` now `await` AsyncStorage writes with `captureException` error handling; previously fire-and-forget
- [x] Volume top-up schedule awareness (GH#95) — `buildVolumeTopUp` now accepts `upcomingLifts` and skips exercises associated with lifts scheduled later in the week; `JITInput.upcomingLifts` populated via `fetchUpcomingSessionLifts` in jit.repository.ts; prevents back-to-back muscle group loading (e.g., leg press on bench day before squat day); 3 new tests
- [x] Intra-session volume recovery (GH#92) — `evaluateVolumeRecovery()` in `training-engine/src/adjustments/volume-recovery.ts`; when JIT reduces sets (soreness/readiness/cycle-phase/disruption) but actual RPE is ≥1.5 below target, `VolumeRecoveryBanner` offers to add removed sets back; `checkVolumeRecovery()` fires after each main lift RPE entry; `sessionStore.acceptRecovery()` appends recovered sets with `is_recovered: true`; recovery blocked during soreness-5 recovery mode; 14 tests

---

## Planned / Future

### 4-Day Programs with Overhead Press — [design doc](../design/four-day-ohp.md)

- [ ] types-003: Add `overhead_press` to Lift enum — [spec](../specs/03-types/types-003-ohp-lift-enum.md)
- [ ] engine-036: 4-lift cube rotation — [spec](../specs/04-engine/engine-036-four-lift-cube-rotation.md)
- [ ] engine-037: OHP formula config defaults — [spec](../specs/04-engine/engine-037-ohp-formula-config.md)
- [ ] engine-038: OHP auxiliary exercise catalog — [spec](../specs/04-engine/engine-038-ohp-auxiliary-catalog.md)
- [ ] engine-039: OHP muscle mapping for primary lift volume — [spec](../specs/04-engine/engine-039-ohp-muscle-mapping.md)
- [ ] mobile-043: OHP onboarding + app services — [spec](../specs/09-mobile/mobile-043-ohp-onboarding.md)
- [ ] mobile-044: OHP UI across screens — [spec](../specs/09-mobile/mobile-044-ohp-ui-screens.md)
- [ ] data-009: OHP lifter maxes schema + migration — [spec](../specs/05-data/data-009-ohp-lifter-maxes.md)

### LLM Challenge Mode — [design doc](../design/llm-challenge-mode.md) | [spec](10-ai/ai-002-challenge-mode.md)

- [x] ai-002: Challenge mode — `JudgeReviewSchema`/`DecisionReplaySchema` in shared-types; `JUDGE_REVIEW_SYSTEM_PROMPT`/`DECISION_REPLAY_SYSTEM_PROMPT` in prompts.ts; `reviewJITDecision` + `scoreDecisionReplay` engine functions; `challenge_reviews` + `decision_replay_logs` DB tables; judge fires from `runJITForSession()` (fire-and-forget); replay fires from `completeSession()` (fire-and-forget); challenge banner on session screen; dashboard pages for both; `jit_input_snapshot` expanded to full JITInput; ai-overview.md updated with §10/§11

### Fun Badges — [design doc](../design/fun-badges.md)

- [x] Badge catalog — 46 badge definitions in `training-engine/src/badges/badge-catalog.ts`
- [x] Badge types — `BadgeId`, `BadgeDef`, `EarnedBadge`, `BadgeCheckContext` in `badge-types.ts`
- [x] Pure checkers — 10 checker files in `training-engine/src/badges/checkers/` (performance, situational, RPE, volume, milestones, wild-rare, lift-identity, rest-pacing, consistency, program-loyalty)
- [x] `user_badges` table — migration `20260322000000_add_user_badges.sql` with RLS
- [x] Badge repository — `badge.repository.ts` (fetchUserBadgeIds, insertBadges, fetchUserBadges)
- [x] Badge detection service — `badge-detection.service.ts` orchestrator; wired into `detectAchievements()`
- [x] BadgeCard component — animated slide-up card (mirrors StarCard)
- [x] Completion screen — renders BadgeCards after star cards
- [x] Achievements screen — "Badges" section in AchievementsSection
- [x] Consistency badges data fetchers — Dawn Patrol, Night Owl, Sunday Scaries, Iron Monk, 365, Perfect Week, Leg Day Loyalist; `fetchConsistencyData` in badge-detection.service.ts
- [x] Contextual badges data wiring — sleep/energy from `soreness_checkins.ratings` JSONB; disruption context from `disruptions` table; Volume Goblin via `fetchPrTypeCounts`; `actual_rest_seconds` wired from `session_logs.actual_sets` JSONB
- [x] Program loyalty badges data fetchers — Old Faithful, Shiny Object Syndrome, Deload Denier; `fetchProgramLoyaltyData` queries programs + formula_configs + deload sessions
- [x] Remaining badge checks wired — Volume Goblin (situational), Jack of All Lifts (volume-rep, `fetchUniqueAuxExercisesInCycle`), Zen Master (rest-pacing, `fetchConsecutiveFullRestSessions`), Streak Breaker (wild-rare, `detectStreakBreakAndRebuild` pure function + `fetchStreakBreakAndRebuild` service)
- [x] Previous e1RM for "Technically a PR" — pre-upsert values captured in `detectAchievements` and passed via `previousE1Rm` field
- [ ] Power Couple — deferred (needs partner linking)

### Other

- [ ] Sleep data integration (wearables → JIT context)
- [ ] Health app integration for cycle tracking
- [ ] Multi-cycle pattern analysis for female lifters
