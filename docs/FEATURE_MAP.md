# Feature Map

Canonical feature → code location reference. Check this before exploring the codebase.

## App Modules (`apps/parakeet/src/modules/`)

All feature code lives here. Import via alias, never via deep paths.

### `@modules/auth`

Path: `modules/auth/`
Covers: Sign-in, Google OAuth, email OTP, Supabase session lifecycle.

Key exports: `useAuth`, `AuthService`, auth repository types.

### `@modules/program`

Path: `modules/program/`
Covers: Active program read/write, lifter maxes submission, auxiliary exercise config, formula config, cycle-on-complete trigger.

Key exports: `useActiveProgram`, `ProgramService`, `getCurrentMaxes`, `submitMaxes`, `getAuxiliaryPool`, `lockAssignment`, `getFormulaConfig`.

### `@modules/session`

Path: `modules/session/`
Covers: Session CRUD, JIT trigger, rest timer notifications, sync queue, missed session reconciliation, overtime edge detection, post-workout motivational message (LLM).

Key exports: `useTodaySession`, `useTodaySessions`, `useMissedSessionReconciliation`, `useRestNotifications`, `useSyncQueue`, `SessionService`, `findTodaySession`, `startSession`, `completeSession`, `skipSession`, `detectOvertimeEdge`, `fetchMotivationalContext`, `generateMotivationalMessage`.

### `@modules/jit`

Path: `modules/jit/`
Covers: JIT session generation — formula, LLM, and hybrid strategies. Max estimation helpers.

Key exports: `runJIT` (or equivalent from `lib/jit`), `estimateMax`.

### `@modules/history`

Path: `modules/history/`
Covers: Performance trends by lift, recent lift history for in-session sheet, performance helpers.

Key exports: `getPerformanceByLift`, `getPerformanceTrends`, `getRecentLiftHistory`, `processRecentHistory`.

### `@modules/disruptions`

Path: `modules/disruptions/`
Covers: Report, apply adjustment, resolve, and list training disruptions.

Key exports: `reportDisruption`, `applyDisruptionAdjustment`, `resolveDisruption`, `getActiveDisruptions`, `getDisruptionHistory`.

### `@modules/cycle-review`

Path: `modules/cycle-review/`
Covers: Post-cycle analysis compilation, LLM coaching report generation, developer suggestions storage, previous cycle summaries.

Key exports: `useCycleReview`, `CycleReviewService`, `getCycleReview`, `compileCycleReport`, `storeCycleReview`, `getPreviousCycleSummaries`.

### `@modules/cycle-tracking`

Path: `modules/cycle-tracking/`
Covers: Menstrual cycle config (length, start date), current cycle phase calculation, stamping phase on session complete.

Key exports: `useCyclePhase`, `getCycleConfig`, `updateCycleConfig`, `getCurrentCycleContext`, `stampCyclePhaseOnSession`.

### `@modules/settings`

Path: `modules/settings/`
Covers: Rest timer prefs, warmup config, JIT strategy override, developer suggestions list.

Key exports: `SettingsService`, `getRestTimerPrefs`, `setRestTimerPrefs`, `getJITStrategyOverride`, `setJITStrategyOverride`, `getWarmupConfig`, `updateWarmupConfig`, `getUserRestOverrides`, `setRestOverride`, `getDeveloperSuggestions`, `updateSuggestionStatus`.

### `@modules/achievements`

Path: `modules/achievements/`
Covers: PR detection, streak computation, cycle badges, Wilks history, achievement detection hook.

Key exports: `useAchievementDetection`, `getPRHistory`, `getStreakData`, `getCycleBadges`, `getWilksHistory`.

### `@modules/training-volume`

Path: `modules/training-volume/`
Covers: Weekly volume per muscle group, MRV/MEV config CRUD.

Key exports: `useWeeklyVolume`, `getMrvMevConfig`, `updateMuscleConfig`, `resetMuscleToDefault`.

### `@modules/wilks`

Path: `modules/wilks/`
Covers: Wilks 2020 score computation using lifter maxes and body weight.

Key exports: `WilksService` (or equivalent).

### `@modules/profile`

Path: `modules/profile/`
Covers: Athlete profile read/write — name, biological sex, date of birth.

Key exports: `ProfileService`, `getProfile`, `updateProfile`.

---

## Platform (`apps/parakeet/src/platform/`)

Infrastructure only. No feature business logic.

| Path | Alias | What it provides |
| ---- | ----- | ---------------- |
| `platform/supabase/` | `@platform/supabase` | Supabase client, database types, bootstrap |
| `platform/query/` | `@platform/query` | React Query client, query key registry, default options |
| `platform/network/` | `@platform/network` | Network status hook, JSON codec helpers |
| `platform/store/` | (direct import) | Zustand stores: `sessionStore`, `syncStore` |
| `platform/lib/` | (direct import) | Storage adapter, rest notification scheduler |
| `platform/utils/` | (direct import) | `captureException` wrapper |

---

## Shared (`apps/parakeet/src/shared/`)

Cross-feature, domain-agnostic utilities and types.

| Path | What it provides |
| ---- | ---------------- |
| `shared/types/domain.ts` | App-layer domain types (mirrors DB shapes for UI use) |
| `shared/types/navigation.ts` | Expo Router typed params |
| `shared/utils/date.ts` | Date formatting helpers |
| `shared/constants/training.ts` | Training constants (lift names, muscle groups, etc.) |
| `shared/network/database.ts` | Shared DB row type helpers |

---

## Packages

### `@parakeet/training-engine`

Path: `packages/training-engine/src/`
Pure TypeScript. No React, no Supabase.

What it contains: 1RM formulas, cube scheduler, loading calculator, program generator, JIT session generator, MRV/MEV calculator, performance adjuster, auxiliary rotator, soreness adjuster, warmup calculator, Wilks formula, cycle phase calculator, PR detection, cycle review generator, hybrid JIT strategy, developer suggestion engine.

Entry: `packages/training-engine/src/index.ts`
Tests: Vitest, 336 tests — `nx run training-engine:test`

### `@parakeet/shared-types`

Path: `packages/shared-types/src/`
Zod schemas and inferred TypeScript types shared between app and engine.

Key schemas: `FormulaOverridesSchema`, `CreateFormulaConfigSchema`, `DisruptionSchema`, `JITAdjustmentSchema`, `CycleReviewSchema`.

Entry: `packages/shared-types/src/index.ts`

---

## Routing (`apps/parakeet/src/app/`)

Expo Router shell only — no business logic. Screens compose module APIs.

Key routes:
- `(tabs)/today.tsx` — Today screen (workout card, volume, disruption banners)
- `(tabs)/session/[sessionId].tsx` — Active session logging
- `(tabs)/session/complete.tsx` — Session complete screen
- `(tabs)/session/soreness.tsx` — Pre-session soreness check-in
- `(tabs)/program.tsx` — Program week/block grid view
- `(tabs)/history.tsx` — Performance trends and session history
- `(tabs)/settings.tsx` — Settings hub
- `(auth)/welcome.tsx` — Auth/sign-in
- `(auth)/onboarding/` — Onboarding flow (maxes, program settings, review)
- `formula/editor.tsx` — Formula editor with AI suggestions
- `disruption-report/report.tsx` — Disruption reporting flow
- `history/cycle-review/[programId].tsx` — Post-cycle review
- `history/cycle-patterns.tsx` — Cycle phase history
- `settings/` — Settings sub-screens
