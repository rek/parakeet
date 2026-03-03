# Docs Index

Use this as the single entry point for project documentation.

## Start Here

1. [PROJECT_ORGANIZATION.md](./PROJECT_ORGANIZATION.md)
   Canonical repo/app structure and import boundaries (`modules`, `platform`, `shared`).
2. [dev.md](./dev.md)
   Day-to-day commands (typecheck, tests, db workflows).
3. [CODE_STYLE.md](./CODE_STYLE.md)
   TypeScript and React Native conventions. Starts with a Quick Reference.
4. [AI_WORKFLOW.md](./AI_WORKFLOW.md)
   Design → plan → implementation workflow.

## Feature Navigator

Use this to find code without searching. Full detail in [FEATURE_MAP.md](./FEATURE_MAP.md).

| Feature | Import alias | Covers |
| ------- | ----------- | ------ |
| Auth | `@modules/auth` | Sign-in, Google OAuth, email OTP, session |
| Program | `@modules/program` | Active program, lifter maxes, auxiliary config, formula config |
| Session | `@modules/session` | Session lifecycle, JIT trigger, rest timer, sync queue |
| JIT | `@modules/jit` | JIT session generation (formula/LLM/hybrid strategies) |
| History | `@modules/history` | Performance trends, lift history, recent sets |
| Disruptions | `@modules/disruptions` | Report/apply/resolve training disruptions |
| Cycle Review | `@modules/cycle-review` | Post-cycle analysis, LLM coaching, developer suggestions |
| Cycle Tracking | `@modules/cycle-tracking` | Menstrual cycle config, current phase |
| Settings | `@modules/settings` | Rest prefs, warmup config, JIT strategy, developer suggestions |
| Achievements | `@modules/achievements` | PRs, streaks, Wilks badges, detection hook |
| Training Volume | `@modules/training-volume` | Weekly volume, MRV/MEV config |
| Wilks | `@modules/wilks` | Wilks score computation |
| Profile | `@modules/profile` | User profile CRUD |

**Platform (infra):** `@platform/supabase`, `@platform/query`, `@platform/network`, `@platform/store`
**Shared (cross-feature):** `@shared/types`, `@shared/utils`, `@shared/constants`
**Engine (pure domain):** `@parakeet/training-engine` — no Supabase, no React

## Architecture

- [design/training-engine-architecture.md](./design/training-engine-architecture.md)
- [decisions/](./decisions/) (ADRs)

## Product/Feature Docs

- [design/](./design/) for product-level intent (what/why)
- [specs/](./specs/) for implementation tasks (how)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for what's done vs planned

## Templates

- [design/_TEMPLATE.md](./design/_TEMPLATE.md)
- [decisions/_TEMPLATE.md](./decisions/_TEMPLATE.md)
- [specs/_TEMPLATE.md](./specs/_TEMPLATE.md)
