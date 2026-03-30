Be concise.

## System Intent

Read [docs/intent.md](./docs/intent.md) first — system goals and philosophy. Strength, not bodybuilding.

## Context Priming

Before starting any non-trivial work, read these in order:

1. [docs/intent.md](./docs/intent.md) — why the app exists, core goal
2. [docs/README.md](./docs/README.md) — documentation layers, feature navigator, module map
3. [docs/domain/README.md](./docs/domain/README.md) — index of all training science (constants, formulas, research)
4. [docs/specs/implementation-status.md](./docs/specs/implementation-status.md) — what's built vs planned

For feature/bug work, also read:
- [docs/guide/ai-workflow.md](./docs/guide/ai-workflow.md) — orient > design > plan > implement > validate > wrap up
- [docs/backlog.md](./docs/backlog.md) — prioritized work items

To solve a GitHub issue: read the issue, check `docs/backlog.md` for related items, then follow `docs/guide/ai-workflow.md`. Or use `/solve-issue <number>`.

## Domain Knowledge

Training science constants, formulas, and thresholds live in [docs/domain/](./docs/domain/). This is the **single source of truth** for all numeric values in the engine. Read the relevant domain doc before changing any training constant.

| Domain doc | When to read |
| --- | --- |
| [domain/periodization.md](./docs/domain/periodization.md) | Block loading, sets/reps/RPE, rest times, progressive overload |
| [domain/volume-landmarks.md](./docs/domain/volume-landmarks.md) | MRV/MEV defaults, training age, volume classification |
| [domain/muscle-mapping.md](./docs/domain/muscle-mapping.md) | Lift contributions, RPE scaling, volume attribution |
| [domain/session-prescription.md](./docs/domain/session-prescription.md) | JIT pipeline steps, warmup, volume top-up |
| [domain/adjustments.md](./docs/domain/adjustments.md) | Soreness, readiness, cycle phase, disruption modifiers |
| [domain/sex-differences.md](./docs/domain/sex-differences.md) | All male/female differentiation |
| [domain/exercise-catalog.md](./docs/domain/exercise-catalog.md) | Exercise types, weight scaling, rep targets |
| [domain/athlete-signals.md](./docs/domain/athlete-signals.md) | All inputs collected from the lifter |
| [domain/performance-analysis.md](./docs/domain/performance-analysis.md) | 1RM, Wilks, PRs, calibration |
| [domain/ai-coaching.md](./docs/domain/ai-coaching.md) | LLM models, strategies, constraints |
| [domain/references.md](./docs/domain/references.md) | External research citations |

## Required Reading (on-demand)

| Doc                                                                   | When to read             |
| --------------------------------------------------------------------- | ------------------------ |
| [guide/project-organization.md](./docs/guide/project-organization.md) | Adding files or modules  |
| [guide/code-style.md](./docs/guide/code-style.md)                     | Writing code             |
| [guide/ai-workflow.md](./docs/guide/ai-workflow.md)                   | Non-trivial features     |
| [guide/ai-learnings.md](./docs/guide/ai-learnings.md)                 | Debugging or reviewing   |
| [guide/dev.md](./docs/guide/dev.md)                                   | Running/building/testing |
| [guide/react-query-patterns.md](./docs/guide/react-query-patterns.md) | Data layer / React Query |

## Architecture Baseline

- App uses module-first architecture in `apps/parakeet/src/modules`.
- `app/` is routing/composition only.
- `platform/` is infra only.
- `shared/` is cross-feature reusable code.
- Prefer module public APIs: `@modules/<feature>`.

## Validation Baseline

Run `/verify` before handoff. It checks typecheck, boundaries, and tests.
