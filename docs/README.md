# Docs Index

Use this as the single entry point for project documentation.

## Documentation Layers

| Layer | Path | What to find there |
|-------|------|--------------------|
| **Intent** | [intent.md](./intent.md) | Why the app exists, design philosophy |
| **Domain** | [domain/](./domain/) | Training science truth: constants, formulas, research ranges. **Single source for all numeric values.** |
| **Guides** | [guide/](./guide/) | How to work: code style, project org, dev commands, AI workflow |
| **Features** | [features/](./features/) | Feature-centric docs: each dir has `index.md` (status, modules), `design*.md` (rationale), `spec-*.md` (implementation plans). |
| **ADRs** | [decisions/](./decisions/) | Architectural choices and tradeoffs |
| **Status** | Each `features/*/index.md` frontmatter | What's built vs planned per feature |

See [guide/ai-workflow.md](./guide/ai-workflow.md) for the full workflow and when to read/update each layer.

## Start Here

0. [intent.md](./intent.md) — system vision, goals, **strength not bodybuilding**
1. [domain/](./domain/) — training science reference (read when working on engine or values)
2. [features/](./features/) — feature-centric docs (each dir = one feature with index, design, specs)
3. [guide/project-organization.md](./guide/project-organization.md) — repo structure and import boundaries
4. [guide/code-style.md](./guide/code-style.md) — TypeScript and React Native conventions
5. [guide/dev.md](./guide/dev.md) — day-to-day commands
6. [guide/ai-workflow.md](./guide/ai-workflow.md) — design, plan, implement, validate, wrap up
7. [guide/react-query-patterns.md](./guide/react-query-patterns.md) — data layer patterns and anti-patterns

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
| Video Analysis  | `@modules/video-analysis`  | Bar path tracking, form faults, LLM coaching, personal baselines             | `useVideoAnalysis`, `useFormCoaching`                  |
| Gym Partners    | `@modules/gym-partners`    | Partner pairing, filming for partners, partner session visibility             | `usePartners`, `usePartnerFilming`, `PartnerSection`   |

**Platform (infra):** `@platform/supabase`, `@platform/query`, `@platform/network`, `@platform/store`
**Shared (cross-feature):** `@shared/types`, `@shared/utils`, `@shared/constants`
**Engine (pure domain):** `@parakeet/training-engine` — no Supabase, no React

## Architecture

- [features/core-engine/design-architecture.md](./features/core-engine/design-architecture.md)
- [decisions/](./decisions/) (ADRs)

## Templates

- [features/\_TEMPLATE/design.md](./features/_TEMPLATE/design.md)
- [features/\_TEMPLATE/spec-TEMPLATE.md](./features/_TEMPLATE/spec-TEMPLATE.md)
- [decisions/\_TEMPLATE.md](./decisions/_TEMPLATE.md)
