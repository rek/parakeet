# Domain Knowledge

Single source of truth for training science decisions in Parakeet. Every constant, formula, and threshold used by the training engine is documented here with its value, source file, and rationale.

## Documents

| Doc | Covers |
|-----|--------|
| [periodization.md](periodization.md) | Cube method, block loading tables (M/F), progressive overload, rest times, training day patterns, unending mode |
| [volume-landmarks.md](volume-landmarks.md) | MRV/MEV defaults (M/F), training age multipliers, volume status classification |
| [muscle-mapping.md](muscle-mapping.md) | Lift-to-muscle contribution factors, RPE scaling curve, volume attribution method |
| [session-prescription.md](session-prescription.md) | JIT pipeline (9 steps), compounding rules, MRV cap, warmup protocols, volume top-up |
| [adjustments.md](adjustments.md) | Soreness, readiness, cycle phase, disruption, volume recovery, performance adjuster |
| [sex-differences.md](sex-differences.md) | All male/female differentiation in one place |
| [exercise-catalog.md](exercise-catalog.md) | Exercise types, weight scaling, rep targets, fatigue factor, pool rotation |
| [athlete-signals.md](athlete-signals.md) | All inputs collected from the lifter and how they flow through the system |
| [performance-analysis.md](performance-analysis.md) | 1RM formulas, working 1RM, Wilks, PR detection, modifier calibration |
| [ai-coaching.md](ai-coaching.md) | LLM models, JIT strategy, constraints, challenge mode, cycle reviews |
| [references.md](references.md) | All external citations with URLs |

## Rules

1. Every constant must have a **value**, **source** (file path), and **rationale**.
2. Update these docs when changing engine constants.
3. Known issues are marked with `> **Known issue:**` callouts linking to GitHub issues.
4. Cross-links use relative paths (e.g., `[adjustments.md](adjustments.md)`).
