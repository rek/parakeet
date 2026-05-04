---
feature: wearable
status: planned
modules: [wearable, jit, session, cycle-review, settings, disruptions]
---
# Wearable Integration

Android Health Connect → wearable biometric ingestion → JIT pipeline.
Replaces (or extends) the subjective sleep/energy 5-pill selectors with objective HRV, RHR, sleep stages, and intra-session HR. Backward compatible: zero regression when no wearable is connected.

## Design
- [design.md](./design.md) — feature design (problem, signals, flows, decisions)

## Phases

| Phase | Goal | Specs |
|-------|------|-------|
| **1 — Data Pipeline** | Health Connect → DB. No engine, no UI changes (settings only). | [biometric-types](./spec-biometric-types.md), [biometric-data](./spec-biometric-data.md), [expo-plugin](./spec-expo-plugin.md), [pipeline](./spec-pipeline.md) (§§1–9, §12), [readiness-adjuster](./spec-readiness-adjuster.md) §2 (`computeReadinessScore` only) |
| **2 — Engine Integration** | Wearable adjuster + dispatch + JIT wiring. | [readiness-adjuster](./spec-readiness-adjuster.md) (full), [pipeline](./spec-pipeline.md) §10, [cycle-review-recovery](./spec-cycle-review-recovery.md) |
| **3 — Pre-Session UI** | RecoveryCard on `soreness.tsx`. Settings status row. | [recovery-card](./spec-recovery-card.md) |
| **4 — Intra-Session HR** | Live BPM badge + post-session HR metrics + replay enrichment. | [intra-hr](./spec-intra-hr.md) |
| Deferred | SpO2 auto-disruption — Oura does not write SpO2 to Health Connect. | [spo2-disruption](./spec-spo2-disruption.md) |

## Specs

| Spec | Phase | Status | Concern |
|------|-------|--------|---------|
| [spec-biometric-types.md](./spec-biometric-types.md) | 1 | planned | Zod schemas + types |
| [spec-biometric-data.md](./spec-biometric-data.md) | 1 (+ Phase 4 migration) | planned | Tables, RLS, indexes, repositories |
| [spec-expo-plugin.md](./spec-expo-plugin.md) | 1 | planned | `react-native-health-connect` Expo plugin + manifest |
| [spec-pipeline.md](./spec-pipeline.md) | 1 + 2 (JIT wiring §10) | planned | Wearable app module: Health Connect lib, sync, recovery, hooks, settings |
| [spec-readiness-adjuster.md](./spec-readiness-adjuster.md) | 2 (§2 in Phase 1) | planned | Engine: wearable adjuster, dispatch, prompts |
| [spec-cycle-review-recovery.md](./spec-cycle-review-recovery.md) | 2 | planned | CycleReport recovery summary + prompt |
| [spec-recovery-card.md](./spec-recovery-card.md) | 3 | planned | Pre-session RecoveryCard UI on `soreness.tsx` |
| [spec-intra-hr.md](./spec-intra-hr.md) | 4 | planned | Real-time HR + post-session metrics + replay |
| [spec-spo2-disruption.md](./spec-spo2-disruption.md) | Deferred | deferred | SpO2 auto-disruption (revive when device supports) |

## Dependency Graph

```
biometric-types ─────┬─► biometric-data ──┐
                     │                     ├─► pipeline ──┬─► recovery-card
                     │                     │              └─► intra-hr
                     └─► readiness-adjuster (§2 score) ───┘
                                                          │
expo-plugin ──────────────────────────────────────────────┤
                                                          │
                              readiness-adjuster (full) ──┤
                              cycle-review-recovery ──────┘
                              spo2-disruption (deferred, isolated)
```

## Key Decisions Encoded in Specs

- **5-day baseline warmup** before wearable adjuster fires. Enforced in `baseline.service` ([spec-pipeline.md](./spec-pipeline.md) §2). Engine does not track warmup state.
- **Composite readiness score** computed in `packages/training-engine/src/adjustments/readiness-score.ts` (pure). App's `recovery.service` imports from `@parakeet/training-engine`.
- **Subjective fallback is automatic.** When `hasWearableData(input)` returns false, engine falls back to `getReadinessModifier`. The soreness screen passes wearable fields via `runJITForSession` — readiness-card-vs-pickers UI choice is independent of engine dispatch.
- **Soreness screen is `apps/parakeet/src/app/(tabs)/session/soreness.tsx`** (no separate `SorenessCheckin` component). RecoveryCard slots in alongside the inline `ReadinessPillRow` selectors.
- **Module boundaries.** Wearable module is a leaf — depends on `@platform/*`, `@parakeet/training-engine`, `@parakeet/shared-types`, `@modules/auth`. JIT module imports wearable repository (one-way). SpO2 disruption (deferred) would create a wearable→disruptions dep — re-evaluate when revived.
- **Migrations:** `20260429000000_add_biometric_tables.sql` (Phase 1), `20260429000001_add_session_hr_data.sql` (Phase 4).

## Validation Checklist (per phase)

| Phase | Pass criteria |
|-------|---------------|
| 1 | Sync runs on foreground; readings persist; `recovery_snapshots` populated; settings screen functional; no behavior change in JIT (no warmup → engine ignores wearable fields). |
| 2 | JIT trace shows `wearable-readiness` label when ≥5 days of HRV present; subjective adjuster otherwise. CycleReport contains `recoverySummary`. |
| 3 | RecoveryCard renders with snapshot present; existing pickers render without. |
| 4 | HR samples + summary stored on `session_logs` when wearable connected during session. Replay payload contains `hrData`. |
