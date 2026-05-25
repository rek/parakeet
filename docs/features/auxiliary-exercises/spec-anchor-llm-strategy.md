# Spec: Aux Anchor in LLM & Hybrid Strategies

**Status**: Implemented (2026-05-25)
**Domain**: Training Engine + AI Prompts
**Parent**: [spec-history-anchored-weight.md](./spec-history-anchored-weight.md)
**Issue**: [GH#223](https://github.com/rek/parakeet/issues/223)

## What This Covers

Closes the gap where `'llm'` and `'hybrid'` JIT strategies prescribe auxiliary weight from the catalog formula and emit `AuxiliaryWork.anchor: undefined` on the configured aux pair. The divergence note silently hides for those rows and the LLM's prescription is uncalibrated to per-aux history.

The formula trace pass still computes the anchor (so post-session calibration sees the data), and volume top-up rows produced by `buildVolumeTopUp` already honor the anchor — the gap is **only** the configured aux pair built inside `applyAdjustment` in `llm-jit-generator.ts`.

## Current Gap (precise)

In `packages/training-engine/src/generator/llm-jit-generator.ts:226-235`, the LLM path computes the configured aux pair via:

```ts
const baseAuxWeight = roundToNearest(
  computeAuxWeight({ exercise, oneRmKg, lift, biologicalSex }),
  increment
);
```

This call **omits** the optional `anchorKg` parameter that `computeAuxWeight` learned from GH#221. The LLM never proposes anchor-vs-formula reasoning back to the engine (no schema field), and the emitted `AuxiliaryWork` has no `anchor` metadata, so:

- `AuxAnchorNote` divergence note does not render on LLM rows.
- The lifter cannot see why the LLM's aux weight differs from the formula or their history.
- Calibration still sees the formula trace's anchor data — calibration is **not** broken today.

`buildJITContext` (`llm-jit-generator.ts:85-113`) spreads `JITInput` into the prompt and already includes `auxHistory`, so the LLM has the raw history available. What it lacks is the computed `AuxAnchorResult` and a schema slot to express an anchor-vs-formula decision.

## Design Decision

Three options were called out in the issue:

1. **LLM consumes raw history.** Pass `auxHistory` summary (already in context). LLM reasons holistically.
2. **LLM consumes computed anchor.** Pre-compute `AuxAnchorResult` per exercise, include in prompt context, route through to `AuxiliaryWork.anchor`. LLM treats anchor as base and only proposes adjustments.
3. **Hybrid (both).** Anchor is the base, raw history available for additional reasoning.

**Recommendation: Option 2.** Reasons:

- The anchor decision tree (snap, history, blend, formula, decay) is a deterministic rule the system enforces uniformly. Letting the LLM re-derive it from raw history invites silent drift and makes calibration metrics across strategies non-comparable.
- The UI contract (`AuxiliaryWork.anchor` + divergence note) is anchor-source-centric. Option 2 lets that contract render uniformly across `formula`, `llm`, `hybrid`.
- Option 1 is the de facto state today (the LLM has `auxHistory` in context) and it isn't enough — the UI gap and the schema gap remain.
- Option 3 doubles the prompt cost without a clear benefit. The LLM rarely needs to override the anchor; when it does, a single `anchorOverride` schema field is enough (see schema extension below).

Option 2 with a narrow override escape hatch is the minimum change that closes the UI gap, keeps strategies comparable, and preserves LLM agency for unusual cases.

## System Behavior (Post-Decision)

### Pre-resolve anchor in `applyAdjustment`

Before building the configured aux pair, resolve the anchor for each exercise:

```ts
for (const exercise of input.activeAuxiliaries) {
  const formulaWeightKg = roundToNearest(
    computeAuxWeight({ exercise, oneRmKg, lift, biologicalSex }),
    increment
  );
  const anchorResult = resolveAuxAnchor(
    exercise, formulaWeightKg, input.auxHistory, input.nowIso
  );
  // ...
}
```

Use `resolveAuxAnchor` exported from the engine (already used by `buildAuxiliaryWork` in the formula path; no new public API needed beyond an export).

### Thread anchor through aux weight computation

When the anchor source is `'history'` or `'snap'`, base aux weight = `anchorResult.anchorKg`. For `'blend'`, the blended anchor weight is used. For `'formula'`, the existing `computeAuxWeight` path runs unchanged.

LLM `auxOverrides` (`skip` / `reduce` / `normal`) still apply on top of the anchor base. The existing `proportionalWeightCeiling` (main-intensity propagation, GH#217) still applies.

### Skip post-main fatigue discount on history/snap

LLM strategy currently does not apply the post-main fatigue discount at all — it propagates `intensityRatio` instead. No change needed here: the formula path's "skip discount when source is history/snap" rule is a no-op in the LLM path. Document this explicitly in the spec so a future refactor doesn't reintroduce double-counting.

### Populate `AuxiliaryWork.anchor` uniformly

Every returned `AuxiliaryWork` from the LLM path attaches `anchor` metadata in the same shape used by the formula path:

```ts
anchor: {
  source, confidence, formulaWeightKg, anchorBaseKg, sessionsUsed, rationale
}
```

`anchorBaseKg` is the anchor weight **before** LLM's intensity/volume propagation, mirroring the formula path's "before modifiers" semantic so `AuxAnchorNote.shouldShowAnchorNote` reads correctly across strategies.

### JITAdjustment schema: optional `anchorOverride`

Extend `AuxOverrideSchema` in `packages/shared-types/src/jit.schema.ts` so the LLM can express "I disagree with the computed anchor for this exercise":

```ts
export const AuxOverrideSchema = z.object({
  exercise: z.string(),
  action: z.enum(['skip', 'reduce', 'normal']),
  anchorOverride: z
    .object({
      weightKg: z.number().min(0).max(500),
      reason: z.string().max(160),
    })
    .nullable(),
});
```

Constraints:

- `.nullable()` not `.optional()` — required by OpenAI strict-JSON-schema mode (matches existing pattern in `restAdjustments`).
- When `anchorOverride` is non-null, `applyAdjustment` uses `override.weightKg` as the aux base, sets `anchor.source = 'snap'` with `rationale = override.reason`, and increments a Sentry counter so override frequency is observable.
- Bounded `[0, 500]` so a hallucinated weight cannot crash the rounding pipeline.

This is the option-3-lite escape hatch: the LLM gets the computed anchor as the default; if it has a strong reason (recent injury, deload-after-PR, etc.) it can override with a number + rationale.

### Prompt update

`JIT_SYSTEM_PROMPT` in `packages/training-engine/src/ai/prompts.ts` gains a section explaining:

- For each configured aux exercise, the context includes `auxAnchors[exercise] = { source, anchorBaseKg, formulaWeightKg, sessionsUsed, rationale }`.
- Default behavior: trust the anchor; emit `action: 'normal'` with `anchorOverride: null`.
- Override only when context (disruption, soreness pattern, recent injury) makes the anchor unsafe. State the reason in `anchorOverride.reason`.
- Do NOT override based on raw `auxHistory` alone — the anchor already encodes that signal.

`buildJITContext` adds a top-level `auxAnchors: Record<string, AuxAnchorResult>` for the configured pair (volume top-up exercises do not participate in the LLM prompt).

### Hybrid path: comparison logging

`computeDivergence` in `hybrid-jit-generator.ts` currently only compares main-lift weight and set count. Extend it with optional aux-anchor delta tracking:

```ts
interface DivergenceResult {
  weightPct: number;
  setDelta: number;
  rpeContextSummary: string;
  auxAnchorOverrides?: Array<{
    exercise: string;
    anchorWeightKg: number;
    llmOverrideWeightKg: number;
    reason: string;
  }>;
}
```

Populated only when the LLM emitted at least one non-null `anchorOverride`. Surfaces to `jit_comparison_logs` so override frequency and rationale quality can be reviewed.

No change to `shouldSurfaceToUser` thresholds — anchor overrides are dev-mode visibility, not user-facing.

### Calibration update

`calibration-update.service` (app side) already reads anchor metadata from `PrescriptionTrace`. Anchor-derived LLM prescriptions now also flow through the trace's `AuxExerciseTrace.anchor` — verify the LLM path writes the trace entry (currently the formula trace pass handles it; with this change, `recordAuxiliary` should be called from the LLM path too if not already).

## Tasks

### Phase 1 — Engine: thread anchor into LLM aux path

- [x] (landed) `packages/shared-types/src/jit.schema.ts` — extended `AuxOverrideSchema` with nullable `anchorOverride: {weightKg ∈ [0, 500], reason ≤ 160 chars}`.
- [x] (landed) `packages/training-engine/src/generator/llm-jit-generator.ts` — `applyAdjustment` pre-resolves the engine anchor per active aux, passes anchor base (or LLM override weight) through `computeAuxWeight`, and attaches an `AuxAnchorCarrier` to every returned `AuxiliaryWork` including skipped/timed/severe-soreness rows.
- [x] (landed) `llm-jit-generator.ts` — LLM `anchorOverride` → carrier `source='snap'`, `rationale=override.reason`, `fromLLMOverride=true`, `engineAnchorKg=engine's pre-override anchor`. Bounded + plate-rounded through the existing pipeline.
- [x] (landed) Lifted `resolveAuxAnchor` to `packages/training-engine/src/auxiliary/anchor.ts` so formula + LLM paths share one implementation. Already re-exported via `@parakeet/training-engine` (auxiliary barrel `export *`).

### Phase 2 — Prompt context

- [x] (landed) `buildJITContext` adds `auxAnchors: Record<exerciseName, AuxAnchorResult>` for `activeAuxiliaries`. `auxHistory` still passed for cross-checking, but the prompt instructs default-trust on the anchor.
- [x] (landed) `JIT_SYSTEM_PROMPT` gained an "Auxiliary anchor" section: default-trust rule, when to override (fresh injury, post-PR deload, equipment change), bounds, "do not override based on raw auxHistory alone" guard, and the nullable-not-optional schema requirement.

### Phase 3 — Hybrid comparison + calibration trace

- [x] (landed) `computeDivergence` in `hybrid-jit-generator.ts` extended with optional `auxAnchorOverrides[]`. Populated from `llm.auxiliaryWork[*].anchor.fromLLMOverride === true` (explicit flag, no string matching); field is **absent** (not empty array) when no overrides — distinguishes "no overrides" from "field not implemented".
- [x] (landed) `apps/parakeet/src/modules/jit/lib/jit.ts` writes the divergence JSON via the existing `writeComparisonLog` path — `auxAnchorOverrides` lands automatically inside the `divergence` jsonb column. No DB migration needed.
- [x] (verified) LLM-strategy sessions already write `PrescriptionTrace.AuxExerciseTrace.anchor` because `apps/parakeet/src/modules/jit/lib/jit.ts` re-runs `generateJITSessionWithTrace` (formula path) for the trace regardless of which strategy produced the prescription. Calibration parity holds without code change.

### Phase 4 — UI parity

- [x] (landed) `AuxiliaryWork.anchor` is now populated on every LLM-path row — the existing `AuxAnchorNote.tsx` renders automatically without code change. App-side `AuxiliaryWork.anchor` mirror in `modules/session/model/types.ts` gained `fromLLMOverride` + `engineAnchorKg` to match the engine carrier.
- [x] (landed) `AuxAnchorNote.tsx` explainer sheet prefixes the rationale with "AI suggested: " when `anchor.fromLLMOverride === true`. Note copy itself (anchor vs formula) is unchanged.

### Phase 5 — Tests

- [x] (landed) `packages/training-engine/src/generator/__tests__/llm-jit-generator.test.ts` — new `aux anchor (GH#223)` describe block covers: history-anchored carrier; no-history → carrier absent; LLM `anchorOverride` → `source='snap'` + `fromLLMOverride=true`; schema rejection of out-of-bounds weight; schema rejection of missing `anchorOverride` key (nullable-not-optional); schema accepts explicit `null`; `action: 'reduce'` stacks on anchor base (not formula); `engineAnchorKg` preserved on override.
- [x] (landed) `packages/training-engine/src/generator/__tests__/hybrid-jit-generator.test.ts` — new `auxAnchorOverrides (GH#223)` describe block: populated when LLM emitted overrides; field absent (not empty array) when LLM emitted none.
- [x] (landed) `apps/parakeet/src/modules/session/ui/AuxAnchorNote.test.ts` — regression test for LLM override → divergent anchor still shows the note. (The "AI suggested:" prefix is rendered string content, not gated by `shouldShowAnchorNote`, so it's covered by the type-level wiring rather than a render test — keeps the existing test suite framework-free.)

### Phase 6 — Verification

- [x] (landed) `/verify` clean on changes I touched: boundaries, spec-links, parakeet typecheck, training-engine + parakeet + training-sim + shared-types tests, no new lint errors. Two pre-existing failures on `main` (dashboard `coaching-cache.test.ts` localStorage env + parakeet `cycle-review.test.ts` import ordering) confirmed unrelated.
- [ ] Manual: developer-mode toggle JIT strategy to `'llm'`, complete 3+ sessions of a configured aux, confirm next session's LLM run shows the divergence note with anchor source `history`.
- [ ] Manual: same flow under `'hybrid'`, confirm `jit_comparison_logs` row has anchor data in `divergence`.

## Design Boundaries

- **No new persistence.** `jit_comparison_logs.divergence` is already `jsonb`; no migration.
- **No prompt-side anchor decision tree replication.** The LLM does not re-derive the anchor from raw history — it consumes the computed result and may override with a single numeric weight + reason.
- **Volume top-up rows are unaffected.** They already flow through `buildVolumeTopUp` → `resolveAuxAnchor`. Only the configured aux pair changes.
- **No engine→app coupling.** Anchor type lives in the engine, mirrored duck-typed in app per the parent spec's existing boundary.
- **Override bounded.** `weightKg ∈ [0, 500]` — hallucinated weights cannot escape the rounding/plate pipeline.
- **Calibration parity, not equivalence.** Calibration sees anchor traces from all three strategies, but the LLM strategy may legitimately produce different aux loads than formula for the same input. The point is that both are now visible/explainable, not that they converge.

## Out of Scope

- Cross-variant anchor inference (e.g., paused bench ↔ standard bench). Inherited from parent spec.
- Anchor-aware exercise selection (the LLM choosing which aux to assign based on anchor confidence). The active aux pair is set by the program/rotation layer; the LLM only adjusts loading.
- Multi-aux pair (>2 active). Today `activeAuxiliaries` is `[string, string]`; if that ever expands, this spec generalises trivially.

## Dependencies

- [spec-history-anchored-weight.md](./spec-history-anchored-weight.md) — parent. Anchor decision tree, decay, snap, source semantics all defined there.
- [../jit-pipeline/spec-llm-strategy.md](../jit-pipeline/spec-llm-strategy.md) — `LLMJITGenerator`, `JITAdjustment` schema, error reporting contract.
- [../jit-pipeline/spec-hybrid.md](../jit-pipeline/spec-hybrid.md) — `HybridJITGenerator`, comparison logging, `jit_comparison_logs` table.
- [../core-engine/prescription-trace-integration.md](../core-engine/prescription-trace-integration.md) — `AuxExerciseTrace.anchor` shape.
- [../../domain/exercise-catalog.md](../../domain/exercise-catalog.md) — `weightPct` defaults that the formula fallback path still uses.
