# Spec: History-Anchored Auxiliary Weight

**Status**: Implemented
**Domain**: Training Engine + Data / User Config + UI
**Design**: [design-history-anchored-weight.md](./design-history-anchored-weight.md)
**Issue**: [GH#221](https://github.com/rek/parakeet/issues/221)

## What This Covers

Auxiliary weight prescription is anchored to the lifter's own recent completed sets of the exercise (rolling average of the last 3 sessions). The catalog `weightPct × oneRmKg` formula remains as the cold-start fallback. Two consecutive same-direction overrides snap the anchor to the lifter's number. Stale history decays back to the formula past an 8-week horizon.

The engine remains pure. History is fetched by the app layer and passed in via `JITInput.auxHistory`. No new persisted table; the anchor is computed at JIT time from existing `set_logs` and `sessions.jit_output_trace`.

## System Behavior

### Anchor Decision Tree (`computeAuxAnchor`)

Given a per-exercise history (newest-first, capped at `ANCHOR_WINDOW_SIZE = 3`):

1. **Snap** — last two sessions both have top-set weight diverging from `prescribedWeightKg` in the same direction (both above or both below) and within `ANCHOR_SNAP_TOLERANCE = 0.05` (i.e. 5 % of the heavier of the two top-sets) of each other → `anchor = max(topSet of last two)`, `source = 'snap'`.
2. **History** — ≥ 3 sessions available → `anchor = avg(topSet of last 3)`, `source = 'history'`.
3. **Blend** — 1–2 sessions available → `anchor = lerp(formula, historyAvg, sessionCount / 3)`, `source = 'blend'`.
4. **Formula** — no usable history → `anchor = formulaWeightKg`, `source = 'formula'`.

After the source decision, apply stale-window decay:

- Most-recent session within `ANCHOR_RECENCY_HORIZON_DAYS = 56` (8 weeks) → decay factor = 1.
- Past the horizon, decay lerps linearly to 0 over `ANCHOR_DECAY_DAYS = 28`.
- `anchor = lerp(formula, anchor, decay)`.
- Snap bypasses decay (override sessions are recent by definition).
- When decay reaches 0, source resets to `'formula'`, and `sessionsUsed` / `confidence` are also reset to `0` / `'exploring'` so a fully-decayed result is indistinguishable from a cold start (avoids misleading the post-session calibration trace).

Confidence:
- `snap` → `'high'` regardless of session count.
- 0 sessions → `'exploring'`, 1–2 → `'low'`, 3–5 → `'medium'`, 6+ → `'high'`.

### Modifier Interaction

Once `source ∈ {history, snap}`, `processAuxExercise` **skips** the post-main fatigue discount (`getPostMainFatigueFactor`). The historical sets were logged in the same fatigue context, so applying the discount again would double-count. For `source ∈ {formula, blend}`, the discount applies as before.

All other modifiers (`mainIntensityMultiplier`, `mainLiftVolumeRatio`, no-equipment, soreness skip, MRV cap) still apply on top of the anchor regardless of source.

### Override Detection

A session entry's `prescribedWeightKg` is recovered from `sessions.jit_output_trace.auxiliaries[].weightTrace.finalWeightKg`, matched by canonical catalog slug. Sessions without a recoverable trace produce entries with `prescribedWeightKg: null`; snap detection is inhibited for those entries but they still feed the rolling average. An override is detected when `topSetWeight` differs from `prescribedWeightKg` by at least `ANCHOR_OVERRIDE_MIN_DELTA = 0.02` (a fraction — i.e. ≥ 2 % of prescribed weight, not 0.02 kg).

### Slug-Keyed History

`auxHistory` is keyed by canonical catalog slug, not display name. The repository normalises both the wanted-exercise list and `set_logs` rows to slugs via `getCatalogEntry(name)?.slug ?? slugify(name)`. `set_logs.exercise_slug` is the primary source for the row's slug; legacy rows without that column fall back to `slugify(set_logs.exercise)`. Catalog renames therefore do not break history matching.

### Cold-Start Fallthrough

When `JITInput.auxHistory` is absent or empty for a given exercise, the engine runs the formula path unchanged with `source: 'formula'`. `AuxiliaryWork.anchor` is still populated (so the UI sees a consistent contract), but the divergence note is suppressed.

## File Layout

### Engine — `packages/training-engine/src/auxiliary/anchor.ts` (new)

Pure functions. No I/O.

- `AuxHistoryEntry` — `{ sessionId, completedAt (ISO), prescribedWeightKg | null, sets: [{ weightKg, reps, rpe? }] }`
- `AuxAnchorResult` — `{ anchorKg, source, sessionsUsed, confidence, formulaWeightKg, snapDetected, decayApplied, rationale }`
- `AuxAnchorInput` — `{ formulaWeightKg, history, nowIso, horizonDays?, decayDays?, windowSize? }`
- `computeAuxAnchor(input): AuxAnchorResult` — main entry point implementing the decision tree above
- `detectSnap(history): boolean`
- `computeBlendFactor(sessionCount): number` — linear 0→1 over 0..3 sessions
- `computeStaleDecay({ history, nowIso, horizonDays?, decayDays? }): number`
- `confidenceFor(sessionCount, snapDetected): AuxAnchorConfidence`
- Constants: `ANCHOR_WINDOW_SIZE`, `ANCHOR_RECENCY_HORIZON_DAYS`, `ANCHOR_DECAY_DAYS`, `ANCHOR_SNAP_TOLERANCE`, `ANCHOR_OVERRIDE_MIN_DELTA`

Tests (`anchor.test.ts`):
- No history → formula passthrough, `'exploring'`.
- 1 session → blend at 1/3, `'low'`.
- 3 sessions → pure history average, `'medium'`.
- Snap on two consecutive same-direction overrides within tolerance → `'snap'`, `'high'`, anchor = max of two top sets.
- Snap rejects mixed directions.
- Snap rejects far-apart magnitudes.
- Window cap: only first 3 entries considered.
- Stale 9 weeks → partial decay applied; lerp toward formula.
- Stale 12+ weeks → full decay, source reverts to `'formula'`, `sessionsUsed` resets to `0`, `confidence` resets to `'exploring'`.
- Snap with stale history → snap bypasses decay.
- Top-set selection picks heaviest set, not last set.
- Legacy entries with `prescribedWeightKg: null` do not trigger snap.

### Engine — `packages/training-engine/src/auxiliary/exercise-catalog.ts`

`computeAuxWeight` accepts optional `anchorKg`. When provided and positive, returns it directly (caller is responsible for plate rounding). Otherwise runs the linear or sqrt formula path. Documented in JSDoc.

Tests in `exercise-catalog.test.ts`:
- `anchorKg` provided → returns it, ignoring 1RM and weightPct.
- `anchorKg: 0` → treated as absent; formula path runs.
- `anchorKg` honored for dumbbell/kettlebell exercises (bypasses sqrt scaling).

### Engine — `packages/training-engine/src/generator/steps/processAuxExercise.ts`

Accepts optional `anchorResult: AuxAnchorResult`. When present:
- For source `'history'` or `'snap'`: passes `anchorResult.anchorKg` to `computeAuxWeight` as `anchorKg`, and skips the post-main fatigue discount (`useHistoryAnchor` branch).
- For source `'blend'`: passes the blended `anchorResult.anchorKg` as `anchorKg` (the blend already includes the formula contribution); applies the fatigue discount as normal because the anchor is not yet fully trusted.
- For source `'formula'`: ignores `anchorResult.anchorKg`; formula path runs unchanged.

Anchor metadata is attached to every returned `AuxiliaryWork` — including skipped rows (severe soreness, MRV cap, main lift skipped, timed) — so the UI contract is uniform.

`AuxiliaryWork.anchor` shape:
```typescript
anchor?: {
  source: 'formula' | 'blend' | 'history' | 'snap';
  confidence: 'exploring' | 'low' | 'medium' | 'high';
  formulaWeightKg: number;
  anchorBaseKg: number;
  sessionsUsed: number;
  rationale: string;
};
```

`anchorBaseKg` is the anchor weight BEFORE main-lift modifiers (`mainIntensityMultiplier`, soreness, etc.). The UI divergence note compares this to `formulaWeightKg`, not the post-modifier final prescribed weight. See [docs/guide/ai-learnings.md § Engine & Domain Logic](../../guide/ai-learnings.md) ("Comparison UX needs the pre-modifier base").

Tests in `processAuxExercise.test.ts`:
- Source `'history'`, heavy main day → fatigue discount not applied; final weight = anchor.
- Source `'blend'`, heavy main day → fatigue discount applies on top of the blended base.
- Source `'snap'` → precedence over fatigue regardless of intensity type.
- Source `'formula'` → behaves identically to no-anchor case.
- Severe soreness skip propagates anchor metadata for UI.

### Engine — `packages/training-engine/src/generator/jit-session-generator.ts`

- `JITInput.auxHistory?: Record<string, AuxHistoryEntry[]>` — keyed by canonical slug; display-name keys accepted as fallback for backward compatibility.
- `JITInput.nowIso?: string` — optional clock injection for deterministic stale-decay tests; defaults to `new Date().toISOString()`.
- `resolveAuxAnchor(exercise, formulaWeightKg, auxHistory, nowIso)` — looks up `auxHistory[slug] ?? auxHistory[exercise]`, returns `AuxAnchorResult | undefined`.
- `buildAuxiliaryWork` and `buildVolumeTopUp` both call `resolveAuxAnchor` and thread the result through to `processAuxExercise` / their inline weight computation. Volume top-up picks honor the anchor too.
- `recordAuxiliary` propagates the anchor metadata to `PrescriptionTrace`.

### Engine — `packages/training-engine/src/generator/prescription-trace.ts`

`AuxExerciseTrace.anchor?: AuxAnchorTrace` — `{ source, confidence, sessionsUsed, formulaWeightKg, anchorBaseKg }`. Recorded for post-session calibration so the system can later evaluate whether anchor prescriptions land at appropriate RPE.

### Engine — `packages/training-engine/src/modules/auxiliary/index.ts`

Re-exports `computeAuxAnchor`, `AuxAnchorResult`, `AuxHistoryEntry`, `AuxAnchorSource`, `AuxAnchorConfidence`, and the anchor constants so the app layer can consume types.

### App — `apps/parakeet/src/modules/jit/data/jit.repository.ts`

`fetchAuxHistory(userId, exerciseNames, sessionLimit): Promise<Record<string, AuxHistoryEntry[]>>`:

1. Resolves the input names to canonical slugs via `nameToSlug` (catalog lookup → `slugify` fallback).
2. Queries the last `max(sessionLimit × 4, 12)` rows from `session_logs` ordered by `completed_at` desc.
3. Fetches `sessions.jit_output_trace` for those session IDs (one round trip).
4. Loads `set_logs` for those sessions via `getSessionSetsBySessionIds`.
5. Per session, groups auxiliary set rows by canonical slug. Each row's slug = `set_logs.exercise_slug ?? slugify(set_logs.exercise)`. Rows not matching a `wantedSlugs` entry are skipped.
6. Per (slug, session), recovers `prescribedWeightKg` from `jit_output_trace.auxiliaries[]` by matching the trace entry's display name → slug via the same normaliser. Missing trace fires a Sentry breadcrumb (`category: 'aux-anchor'`).
7. Caps each slug's history at `sessionLimit` (newest-first).
8. Returns a record keyed by canonical slug.

### App — `apps/parakeet/src/modules/jit/lib/jit.ts`

After `activeAuxiliaries` and `auxiliaryPool` are known, calls `fetchAuxHistory(userId, [...activeAuxiliaries, ...auxiliaryPool], 3)` and assigns the result to `JITInput.auxHistory` (omitted entirely when empty).

### App — `apps/parakeet/src/modules/session/model/types.ts`

App-side `AuxiliaryWork.anchor` mirrors the engine's shape (duck-typed; the model is intentionally decoupled from the engine type to keep the app layer importable in isolation).

### App — `apps/parakeet/src/modules/session/ui/AuxAnchorNote.tsx` + `aux-anchor-note.helpers.ts`

`AuxAnchorNote` is mounted in `apps/parakeet/src/app/(tabs)/session/[sessionId].tsx` for both the regular-aux and volume-top-up render loops. It renders a one-line note when the anchor base diverges meaningfully from the formula:

> "Using your recent {anchorBaseKg}kg rather than the formula's {formulaWeightKg}kg"

Both numbers are rounded to the lifter's plate increment.

Tap opens a `Modal` (inlined in the same file) showing source, confidence, sessions used, formula base, anchor base, prescribed today, and the plain-language rationale.

> **Deferred:** the original design also called for a list of the contributing sessions (date, top-set, RPE) inside the modal. Parked in [GH#226](https://github.com/rek/parakeet/issues/226) until there's lifter signal that the rarer "which workouts?" question needs answering.

`shouldShowAnchorNote(...)` is the pure visibility predicate, extracted into `aux-anchor-note.helpers.ts` so it can be unit-tested without React Native. It hides the note when:
- `source === 'formula'`
- `formulaWeightKg <= 0` (bodyweight / timed)
- `|anchorBaseKg − formulaWeightKg| / formulaWeightKg ≤ 0.20`
- `roundToNearest(anchorBaseKg, incr) === roundToNearest(formulaWeightKg, incr)` (plate-rounding hysteresis)

Tests in `AuxAnchorNote.test.ts`:
- Hides on source `'formula'`.
- Hides on zero formula weight.
- Hides within 20% divergence.
- Shows on > 20% divergence for `'history'`, `'snap'`, and `'blend'`.
- Hides under rounding hysteresis even when raw divergence > 20%.
- Falls back to 2.5kg increment when `weightIncrementKg` is non-positive.
- Compares anchor BASE (not prescribed) — locks the modifier-shrinkage guard.

## Design Boundaries

These are permanent design decisions, not deferred work:

- **Cross-variant anchor sharing is off.** Paused bench and standard bench are separate slugs and do not share history. Cross-variant inference would require a similarity model the engine doesn't have.
- **No per-aux RPE-driven shift on top of the rolling average.** The rolling average implicitly captures whether the lifter completed at appropriate effort (heavier sets = heavier anchor). A separate RPE adjuster on top would double-count.
- **No denormalised `aux_weight_anchors` cache table.** Anchor computation is cheap; the only query cost is one extra Supabase fetch per JIT run. Caching adds a sync surface for negligible benefit.
- **App-side `AuxiliaryWork.anchor` is intentionally a duck-typed mirror** of the engine type, not an `import` from `@parakeet/training-engine`. Keeps the session model importable in tests without pulling the engine.

## Dependencies

- [design-history-anchored-weight.md](./design-history-anchored-weight.md) — decision rationale.
- [spec-rotation.md](./spec-rotation.md) — rotation decides which exercises are anchored.
- [spec-config.md](./spec-config.md) — slug stability for custom exercises.
- [../core-engine/prescription-trace-integration.md](../core-engine/prescription-trace-integration.md) — anchor metadata extends the existing trace.
- [../jit-pipeline/spec-generator.md](../jit-pipeline/spec-generator.md) — JIT pipeline integration point.
