# Implementation Status

Consolidated view of what's done vs. planned. Check this before writing new specs or starting exploration.

For details on any item, see the linked spec file.

---

## Training Engine (`packages/training-engine`)

396 tests passing (Vitest). All specs implemented.

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

---

## Shared Types (`packages/shared-types`)

- [x] types-001: Zod schemas — all domain types
- [x] `formula.schema.ts` — `FormulaOverridesSchema`, `CreateFormulaConfigSchema`
- [x] `disruption.schema.ts` — `CreateDisruption`, `TrainingDisruption`, `DisruptionWithSuggestions`
- [x] `jit.schema.ts` — `JITAdjustmentSchema`, `JITAdjustment`
- [x] `cycle-review.schema.ts` — `CycleReviewSchema`, `CycleReview`

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

---

## App Modules (`apps/parakeet/src/modules/`)

Module/platform/shared architecture is the canonical app structure. Legacy top-level folders removed.

- [x] `@modules/auth` — sign-in, Google OAuth, email OTP
- [x] `@modules/program` — active program, maxes, auxiliary config, formula config
- [x] `@modules/session` — lifecycle, JIT trigger, rest timer, sync, missed reconciliation
- [x] `@modules/jit` — JIT generation strategies
- [x] `@modules/history` — performance trends, lift history
- [x] `@modules/disruptions` — report/apply/resolve disruptions
- [x] `@modules/cycle-review` — post-cycle analysis, LLM report, developer suggestions
- [x] `@modules/cycle-tracking` — menstrual cycle config and phase calculation
- [x] `@modules/settings` — rest prefs, warmup config, JIT strategy, developer suggestions UI
- [x] `@modules/achievements` — PRs, streaks, Wilks badges
- [x] `@modules/training-volume` — weekly volume, MRV/MEV config
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
- [x] mobile-028: Unending program UI — Program Style toggle (onboarding), program tab unending branch, "End Program" global rename

---

## Data / Settings Screens

- [x] data-001: Volume config — `settings/volume-config.tsx` (9 muscle MEV/MRV steppers)
- [x] data-002: Auxiliary exercises — `settings/auxiliary-exercises.tsx` (pool reorder, lock)
- [x] data-003: Warmup protocol — `settings/warmup-protocol.tsx` (preset picker, custom steps)
- [x] data-004: Athlete profile — `profiles.biological_sex`, `profiles.date_of_birth`; onboarding wired
- [x] data-005: Cycle tracking — `cycle_tracking` table; `session_logs.cycle_phase`
- [x] data-006: Rest config — `rest_configs` table; per-lift rest overrides

---

## Program Modes

- [x] programs-005: Unending program mode — `program_mode`, `unending_session_counter`, lazy session generation, cycle review on "End Program"

---

## Planned / Future

- [ ] Sleep data integration (wearables → JIT context)
- [ ] Sleep data integration (wearables → JIT context)
- [ ] Health app integration for cycle tracking
- [ ] Multi-cycle pattern analysis for female lifters
