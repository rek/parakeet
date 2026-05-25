# Spec: Aux Anchor in LLM & Hybrid Strategies

**Status**: Draft
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

- [ ] `packages/shared-types/src/jit.schema.ts` — extend `AuxOverrideSchema` with nullable `anchorOverride`. Update the inferred `JITAdjustment` type consumers (none beyond `llm-jit-generator.ts` and tests).
- [ ] `packages/training-engine/src/generator/llm-jit-generator.ts` — in `applyAdjustment`, call `resolveAuxAnchor` for each configured aux exercise before the `auxiliaryWork.map`. Pass `anchorResult.anchorKg` to `computeAuxWeight` (when source ∈ `history`, `snap`, `blend`). Attach `anchor` metadata to every returned `AuxiliaryWork` (including skipped rows, matching formula path's uniform contract).
- [ ] `llm-jit-generator.ts` — when `adj.auxOverrides[i].anchorOverride != null`, use `override.weightKg` as the base, set `anchor.source = 'snap'`, `anchor.rationale = override.reason`. Bound and round per existing pipeline.
- [ ] Export `resolveAuxAnchor` from the engine's `auxiliary` module barrel if it isn't already public.

### Phase 2 — Prompt context

- [ ] `packages/training-engine/src/generator/llm-jit-generator.ts` — `buildJITContext` adds `auxAnchors: Record<exerciseSlug, AuxAnchorResult>` for `activeAuxiliaries` only. Keep `auxHistory` in context too (LLM can still cross-check), but prompt instructs default-trust on the anchor.
- [ ] `packages/training-engine/src/ai/prompts.ts` — add an "Auxiliary anchor" section to `JIT_SYSTEM_PROMPT` describing the anchor contract, when to override, and the schema field semantics.

### Phase 3 — Hybrid comparison + calibration trace

- [ ] `packages/training-engine/src/generator/hybrid-jit-generator.ts` — extend `DivergenceResult` with optional `auxAnchorOverrides[]`. Populate from `llmOutput.auxiliaryWork[*].anchor` entries where `source === 'snap'` and the rationale matches an LLM override (mark these explicitly via an `anchor.fromLLMOverride: true` flag rather than string matching).
- [ ] `apps/parakeet/src/modules/jit/data/comparison-log.repository.ts` (or wherever `jit_comparison_logs` rows are written) — persist the new field as part of the `divergence` JSON column. No DB migration: column is already `jsonb`.
- [ ] Verify LLM path writes anchor metadata to `PrescriptionTrace.AuxExerciseTrace.anchor` for calibration. If `recordAuxiliary` is formula-only today, route LLM aux through the same recorder.

### Phase 4 — UI parity

- [ ] `apps/parakeet/src/modules/session/ui/AuxAnchorNote.tsx` — no code change expected; the divergence note renders automatically once `AuxiliaryWork.anchor` is populated. Add a regression test that mocks an LLM-strategy session output with anchor metadata and asserts the note renders.
- [ ] If `anchor.fromLLMOverride` is set, the explainer sheet's rationale line uses the LLM's override reason verbatim. Minor copy: prefix with "AI suggested:" so the user can distinguish system-anchor from LLM-override.

### Phase 5 — Tests

- [ ] `packages/training-engine/src/generator/__tests__/llm-jit-generator.test.ts`:
  - Aux with 3+ sessions → LLM aux row has `anchor.source === 'history'`, `anchorBaseKg === rolling avg`.
  - Aux with no history → `anchor.source === 'formula'`, divergence note hidden by predicate.
  - LLM returns `anchorOverride: { weightKg: 60, reason: 'recent shoulder tweak' }` → aux base is 60 (or rounded), `anchor.source === 'snap'`, `anchor.rationale` matches reason.
  - LLM returns `anchorOverride: { weightKg: 9999, reason: '...' }` → schema rejects (out of bounds), fallback to formula.
  - `auxOverrides.action: 'reduce'` stacks correctly with anchor base (× 0.9 of anchor, not × 0.9 of formula).
  - Schema parse: missing `anchorOverride` key → schema rejects (nullable-not-optional rule); explicit `null` is accepted.
- [ ] `packages/training-engine/src/generator/__tests__/hybrid-jit-generator.test.ts`:
  - LLM emitted anchor override → `divergence.auxAnchorOverrides` populated, comparison row written.
  - LLM emitted no overrides → field absent from divergence (not present as empty array).
- [ ] `apps/parakeet/src/modules/session/ui/__tests__/AuxAnchorNote.test.tsx`:
  - LLM-strategy session with history-anchored aux → note renders.
  - LLM override → sheet rationale prefixed with "AI suggested:".

### Phase 6 — Verification

- [ ] `/verify` clean (typecheck, boundaries, tests, lint).
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
