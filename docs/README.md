# Docs Index

Use this as the single entry point for project documentation.

## Start Here

0. [intent.md](./intent.md)
   System vision, goals, design philosophy. Read this first.
1. [guide/project-organization.md](./guide/project-organization.md)
   Canonical repo/app structure and import boundaries (`modules`, `platform`, `shared`).
2. [guide/dev.md](./guide/dev.md)
   Day-to-day commands (typecheck, tests, db workflows, local APK builds).
3. [guide/code-style.md](./guide/code-style.md)
   TypeScript and React Native conventions. Starts with a Quick Reference.
4. [guide/ai-workflow.md](./guide/ai-workflow.md)
   Design → plan → implementation workflow.

## Feature Navigator

Use this to find code without searching.

| Feature         | Import alias               | Covers                                                                       | Key Exports                                            |
| --------------- | -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| Auth            | `@modules/auth`            | Sign-in, Google OAuth, email OTP, session                                    | `useAuth`, `AuthService`                               |
| Program         | `@modules/program`         | Active program, lifter maxes, auxiliary config, formula config               | `useActiveProgram`, `ProgramService`, `submitMaxes`    |
| Session         | `@modules/session`         | Session lifecycle, JIT trigger, rest timer, sync queue, motivational message | `useTodaySession`, `SessionService`, `completeSession` |
| JIT             | `@modules/jit`             | JIT session generation (formula/LLM/hybrid strategies)                       | `runJIT`, `estimateMax`                                |
| History         | `@modules/history`         | Performance trends, lift history, recent sets                                | `getPerformanceByLift`, `buildVolumeChartData`         |
| Disruptions     | `@modules/disruptions`     | Report/apply/resolve training disruptions                                    | `reportDisruption`, `getActiveDisruptions`             |
| Cycle Review    | `@modules/cycle-review`    | Post-cycle analysis, LLM coaching, developer suggestions                     | `useCycleReview`, `compileCycleReport`                 |
| Cycle Tracking  | `@modules/cycle-tracking`  | Menstrual cycle config, current phase                                        | `useCyclePhase`, `getCycleConfig`                      |
| Settings        | `@modules/settings`        | Rest prefs, warmup config, JIT strategy, developer suggestions               | `SettingsService`, `getRestTimerPrefs`                 |
| Achievements    | `@modules/achievements`    | PRs, streaks, Wilks badges, detection hook                                   | `useAchievementDetection`, `getPRHistory`              |
| Training Volume | `@modules/training-volume` | Weekly volume, MRV/MEV config                                                | `useWeeklyVolume`, `getMrvMevConfig`                   |
| Wilks           | `@modules/wilks`           | Wilks score computation                                                      | `WilksService`                                         |
| Profile         | `@modules/profile`         | User profile CRUD                                                            | `getProfile`, `updateProfile`                          |

**Platform (infra):** `@platform/supabase`, `@platform/query`, `@platform/network`, `@platform/store`
**Shared (cross-feature):** `@shared/types`, `@shared/utils`, `@shared/constants`
**Engine (pure domain):** `@parakeet/training-engine` — no Supabase, no React

## Architecture

- [design/training-engine-architecture.md](./design/training-engine-architecture.md)
- [decisions/](./decisions/) (ADRs)

## Product/Feature Docs

- [design/](./design/) for product-level intent (what/why)
- [specs/](./specs/) for implementation tasks (how)
- [specs/implementation-status.md](./specs/implementation-status.md) for what's done vs planned

Design docs are organized by feature (what/why). Specs are organized by implementation layer (how), numbered by dependency order.

## Templates

- [design/\_TEMPLATE.md](./design/_TEMPLATE.md)
- [decisions/\_TEMPLATE.md](./decisions/_TEMPLATE.md)
- [specs/\_TEMPLATE.md](./specs/_TEMPLATE.md)
