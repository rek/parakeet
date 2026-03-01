# Agent Guardrails

## Type Safety

- Treat `supabase/types.ts` as generated DB shape only. Never hand-edit.
- Shared domain contracts belong in `packages/shared-types`; engine-internal contracts belong in `packages/training-engine/src/types.ts`.
- Do not create local duplicate interfaces for `Session`/`Program`/`Disruption` shapes in UI code when a canonical type already exists.
- Parse JSON columns at repository boundaries via `apps/parakeet/src/network/json-codecs.ts`; do not pass raw `Json` into services/UI.
- Keep `lib/*` re-export contracts stable. If service-level types are moved, re-export them from service modules to avoid downstream breakage.

## Validation

- Before handing off type refactors in `apps/parakeet`, run:
  - `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json`
- If that fails due to moved exports or schema drift, fix code instead of relaxing types.
