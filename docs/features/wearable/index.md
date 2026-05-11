---
feature: wearable
status: partial
modules: [wearable, jit, session, cycle-review, settings, disruptions]
---
# Wearable Integration

Android Health Connect → wearable biometric ingestion → soreness check-in.
Sleep duration and HRV/RHR % change prefill the subjective sleep/energy pills on the soreness screen. User can override with a tap. Backward compatible: zero regression when no wearable is connected.

## Design
- [design.md](./design.md) — feature design (problem, signals, flows, decisions)

## Phases

| Phase | Goal | Specs |
|-------|------|-------|
| **1 — Data Pipeline** ✅ | Health Connect → DB. Sync + recovery snapshot. | [biometric-types](./spec-biometric-types.md), [biometric-data](./spec-biometric-data.md), [expo-plugin](./spec-expo-plugin.md), [pipeline](./spec-pipeline.md) (§§1–9, §12), [readiness-adjuster](./spec-readiness-adjuster.md) §2 (`computeReadinessScore` only) |
| **1.5 — Subjective Prefill + Sync Gate** ✅ | Map snapshot → sleep/energy pills with "from wearable" hint. Pre-checkin sync via `useEnsureFreshSnapshot` (active sync + query invalidation + auto-generate gate). UI-side translation only; engine continues to use subjective `getReadinessModifier`. | `apps/parakeet/src/modules/wearable/utils/prefill.ts`, `apps/parakeet/src/modules/wearable/hooks/useEnsureFreshSnapshot.ts`, [spec-pipeline.md](./spec-pipeline.md) §9.5 |
| **2 — Engine Integration** ⏸️ deferred | Wearable adjuster + dispatch + JIT wiring. Engine code (`wearable-readiness-adjuster.ts`, `applyReadinessAdjustment` dispatch) ships but is unreachable from production — JIT input no longer carries wearable fields. | [readiness-adjuster](./spec-readiness-adjuster.md) (full), [pipeline](./spec-pipeline.md) §10, [cycle-review-recovery](./spec-cycle-review-recovery.md) |
| **3 — Pre-Session UI** ⏸️ superseded | RecoveryCard component exists in `modules/wearable/ui/` but is no longer rendered on `soreness.tsx` — replaced by Phase 1.5 prefill. | [recovery-card](./spec-recovery-card.md) |
| **4 — Intra-Session HR** | Live BPM badge + post-session HR metrics + replay enrichment. | [intra-hr](./spec-intra-hr.md) |
| Deferred | SpO2 auto-disruption — Oura does not write SpO2 to Health Connect. | [spo2-disruption](./spec-spo2-disruption.md) |

## Specs

| Spec | Phase | Status | Concern |
|------|-------|--------|---------|
| [spec-biometric-types.md](./spec-biometric-types.md) | 1 | done | Zod schemas + types |
| [spec-biometric-data.md](./spec-biometric-data.md) | 1 (+ Phase 4 migration) | done (Phase 1) | Tables, RLS, indexes, repositories |
| [spec-expo-plugin.md](./spec-expo-plugin.md) | 1 | done | `react-native-health-connect` Expo plugin + manifest |
| [spec-pipeline.md](./spec-pipeline.md) | 1 + 2 (JIT wiring §10) | done (Phase 1); §10 deferred | Wearable app module: Health Connect lib, sync, recovery, hooks, settings |
| [spec-readiness-adjuster.md](./spec-readiness-adjuster.md) | 2 (§2 in Phase 1) | §2 done; full deferred | Engine: wearable adjuster, dispatch, prompts. Adjuster code lives in engine but is unreachable; replaced by UI-side prefill (Phase 1.5). |
| [spec-cycle-review-recovery.md](./spec-cycle-review-recovery.md) | 2 | done | CycleReport recovery summary + prompt (uses `recovery_snapshots` directly, independent of JIT path) |
| [spec-recovery-card.md](./spec-recovery-card.md) | 3 | superseded | `RecoveryCard` exists but is no longer rendered. Replaced by sleep/energy pill prefill on `soreness.tsx`. |
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

- **5-day baseline warmup** before adjustments would fire (still enforced in `baseline.service`, [spec-pipeline.md](./spec-pipeline.md) §2). Currently informational only — engine no longer dispatches on wearable signals.
- **Composite readiness score** computed in `packages/training-engine/src/adjustments/readiness-score.ts` (pure). Persisted on `recovery_snapshots.readiness_score`. **Not** consumed by JIT in current path; surfaced via `cycle-review-recovery` summary only.
- **Phase 1.5 — UI-side translation + pre-checkin sync (current).** `apps/parakeet/src/modules/wearable/utils/prefill.ts` maps `sleep_duration_min` → sleep pill and (HRV % change, RHR % change) → energy pill on the **1–5 native scale** (1=worst, 3=neutral, 5=best). JIT input no longer carries wearable fields, so the engine always routes to subjective `getReadinessModifier`. User can override either pill with a tap; "from wearable" hint clears on touch. `useEnsureFreshSnapshot` actively syncs Health Connect on soreness mount, invalidates the snapshot query, and gates auto-generate on the result. See [spec-pipeline.md §9.5](./spec-pipeline.md) for the full contract — including the auto-generate same-commit race rule. **Pill defaults are 3 (engine neutral)** — using 2 would emit a "Low" rationale on every untouched session.
- **Soreness screen is `apps/parakeet/src/app/(tabs)/session/soreness.tsx`** (no separate `SorenessCheckin` component). Pickers always render; `RecoveryCard` is no longer mounted.
- **Module boundaries.** Wearable module is a leaf — depends on `@platform/*`, `@parakeet/training-engine`, `@parakeet/shared-types`, `@modules/auth`. JIT module no longer imports wearable repository — boundary simplified. SpO2 disruption (deferred) would create a wearable→disruptions dep — re-evaluate when revived.
- **Migrations:** `20260429000000_add_biometric_tables.sql` (Phase 1), `20260429000001_add_session_hr_data.sql` (Phase 4 — not yet applied).

## Validation Checklist (per phase)

| Phase | Pass criteria |
|-------|---------------|
| 1 | Sync runs on foreground; readings persist; `recovery_snapshots` populated; settings screen functional. |
| 1.5 | Soreness screen prefills sleep + energy pills from snapshot when present; "from wearable" hint visible; tapping a pill clears its hint and overrides; auto-generate gates on snapshot query settling. |
| 2 (deferred) | JIT trace shows `wearable-readiness` label when ≥5 days of HRV present. Currently never fires — `getReadinessModifier` always wins because subjective pills are populated. |
| 3 (superseded) | n/a — RecoveryCard not rendered. |
| 4 | HR samples + summary stored on `session_logs` when wearable connected during session. Replay payload contains `hrData`. |
