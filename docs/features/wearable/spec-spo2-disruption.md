# Spec: SpO2 Auto-Disruption (Deferred)

**Status**: Deferred / out-of-scope for v1
**Domain**: App / Disruption integration
**Phase**: N/A (revisit when a Health-Connect-writing SpO2 device is in use)
**Owner**: any executor agent if the device situation changes

## Summary

Originally planned: when overnight SpO2 drops below 94%, auto-create a `minor` severity `illness` disruption so the JIT pipeline gracefully reduces load before the lifter consciously notices symptoms. **Dropped from v1** because the recommended device (Oura Ring 4) does not write SpO2 to Android Health Connect — the signal would never fire in practice with the current stack.

The schema retains SpO2 fields for forward compatibility:
- `BiometricType` enum includes `'spo2'`
- `recovery_snapshots.spo2_avg` column exists
- `WearableReadinessInput.spo2Avg` field exists (unused by the adjuster)

This document preserves the design so a future executor can revive it without re-deriving the mechanism.

## Trigger Condition

When `recovery.service.computeAndStoreRecoverySnapshot` runs and the just-computed `spo2_avg` is < 94 AND no active disruption with `disruption_type === 'illness'` exists for the user:

- Create a disruption via `reportDisruption(userId, input)` from `@modules/disruptions`.
- Use these inputs:
  - `disruption_type: 'illness'`
  - `severity: 'minor'`
  - `affected_date_start: <today YYYY-MM-DD>`
  - `affected_date_end: undefined` (open-ended; lifter resolves manually)
  - `description: \`SpO2 reading ${spo2Avg.toFixed(1)}% — possible illness\``

## Why Deferred

- **Oura Ring 4** (recommended hardware) does not surface SpO2 through the Android Health Connect bridge as of this writing. Auto-disruption would never fire.
- **False positives** are a concern — a single low SpO2 reading from a noisy sensor could create a spurious disruption. A real implementation would need:
  - Multi-sample minimum (e.g. mean of overnight samples, not a single point)
  - Persistence threshold (e.g. two consecutive nights below 94% before triggering)
  - User notification on creation (non-silent disruption)
  - "Was this accurate?" feedback loop to tune thresholds

These requirements exceed the cost-benefit until a device with verified Health Connect SpO2 support is in use.

## When to Revive

Trigger conditions for un-deferring this spec:

1. The user adopts a device that writes SpO2 to Health Connect (e.g. some Garmin watches, some Polar models, future Oura firmware).
2. Or: a different signal warrants auto-disruption (e.g. sustained RHR elevation > 15% for 3 consecutive days = overreaching) and this spec is rewritten as `spec-auto-disruption.md` with the new trigger.

## Dependency Direction (when revived)

- The wearable module would import from `@modules/disruptions` to call `reportDisruption`. This is the only sanctioned cross-module import for the wearable feature — document it explicitly in `apps/parakeet/CLAUDE.md` if added.
- Alternatively, dispatch via an event bus / hook so the wearable module remains a leaf (preferred).

## Tasks (when revived)

1. Add `createIllnessFromLowSpO2` private function inside `recovery.service.ts`:
   ```typescript
   async function createIllnessFromLowSpO2(userId: string, spo2Avg: number): Promise<void> {
     const active = await fetchActiveDisruptions(userId);
     if (active.some((d) => d.disruption_type === 'illness')) return;
     await reportDisruption(userId, {
       disruption_type: 'illness',
       severity: 'minor',
       affected_date_start: new Date().toISOString().slice(0, 10),
       description: `SpO2 reading ${spo2Avg.toFixed(1)}% — possible illness`,
     });
   }
   ```

2. Call after computing `spo2Avg` but before snapshot upsert:
   ```typescript
   if (snapshot.spo2_avg !== null && snapshot.spo2_avg < 94) {
     await createIllnessFromLowSpO2(userId, snapshot.spo2_avg);
   }
   ```

3. Surface a user-facing notification (Sentry breadcrumb + in-app banner). A silent disruption is a bad UX — the lifter must know why future sessions are reduced.

4. Add tests:
   - Low SpO2 + no active illness → disruption created.
   - Low SpO2 + existing active illness → no-op (idempotent).
   - Normal SpO2 → no-op.
   - Single low reading vs sustained — TBD by future implementer.

5. Add a memory note `feedback_*` if the implementation reveals additional gotchas (e.g. dedup window beyond "active").

## Out of Scope (until revived)

Everything above. This spec is preserved as design context only.

## References

- [design.md](./design.md) Decisions section — SpO2 auto-disruption explicitly dropped.
- `apps/parakeet/src/modules/disruptions/application/disruption.service.ts` — `reportDisruption` signature + behavior.
- `packages/shared-types/src/disruption.schema.ts` — `DisruptionTypeSchema` enum, `SeveritySchema` (`minor | moderate | major`).
