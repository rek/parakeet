# Spec: Lipedema-tracking data layer + entry UI

**Status**: Implemented

**Domain**: Data / User Config | UI

## What this covers

Table + module + entry screen for weekly lipedema measurement logs.
One row per user per recorded_date; upsert semantics. RLS so only the
owner reads/writes. Feature-flag gated off by default.

## Tasks

**`supabase/migrations/`:**

- [x] `20260421110000_create_lipedema_measurements.sql` —
      `lipedema_measurements` table with user_id FK, recorded_date
      (unique per user), 5 limb landmarks × L/R in integer mm, pain /
      swelling numeric(3,1), notes, photo_url, timestamps. Range
      check constraints 0–10 on pain + swelling.
  → `supabase/migrations/20260421110000_create_lipedema_measurements.sql`
- [x] RLS policies: select / insert / update / delete scoped to
      `auth.uid() = user_id`. No cross-user reads even with service key
      bypass unused here.
  → same file

**`apps/parakeet/src/modules/lipedema-tracking/`:**

- [x] `model/types.ts` — `LipedemaMeasurement`, `MeasurementDraft`,
      `Limb`, `Side`, `LIMB_LABELS`.
  → `apps/parakeet/src/modules/lipedema-tracking/model/types.ts`
- [x] `data/lipedema-tracking.repository.ts` —
      `fetchMeasurements(limit)`, `upsertMeasurement(input)`,
      `deleteMeasurement(id)`. Row → model mapping with camelCase
      conversion. onConflict: `user_id,recorded_date`.
  → `apps/parakeet/src/modules/lipedema-tracking/data/lipedema-tracking.repository.ts`
- [x] `data/lipedema-tracking.queries.ts` — `queryOptions` factory
      with 1-min staleTime.
  → `apps/parakeet/src/modules/lipedema-tracking/data/lipedema-tracking.queries.ts`
- [x] `hooks/useMeasurements.ts` — `useMeasurements`, `useSaveMeasurement`,
      `useDeleteMeasurement`. Mutations invalidate the module's query
      prefix.
  → `apps/parakeet/src/modules/lipedema-tracking/hooks/useMeasurements.ts`
- [x] `lib/units.ts` — `cmStringToMm`, `mmToCmString`, `parseZeroToTen`.
      Pure. 14 unit tests covering round-trip, clamp, trim, null.
  → `apps/parakeet/src/modules/lipedema-tracking/lib/units.ts`
  → `apps/parakeet/src/modules/lipedema-tracking/lib/__tests__/units.test.ts`
- [x] `lib/trends.ts` — `limbTrend(rows, pick)`, `latestDelta(series)`.
      Used by future trend chart; tested now with 5 cases.
  → `apps/parakeet/src/modules/lipedema-tracking/lib/trends.ts`
  → `apps/parakeet/src/modules/lipedema-tracking/lib/__tests__/trends.test.ts`
- [x] `application/draft.ts` — `emptyDraft`, `measurementToDraft`,
      `draftToUpsert`, `draftIsEmpty`. Pure. 4 tests covering
      round-trip and empty-check.
  → `apps/parakeet/src/modules/lipedema-tracking/application/draft.ts`
  → `apps/parakeet/src/modules/lipedema-tracking/application/__tests__/draft.test.ts`
- [x] `ui/TrackingScreen.tsx` — form + history. Preloads today's
      entry if it exists (upsert-in-place). Prevents save on fully
      empty draft. Alert-gated delete. Hooks-before-early-return
      satisfied.
  → `apps/parakeet/src/modules/lipedema-tracking/ui/TrackingScreen.tsx`
- [x] `index.ts` — public API barrel.
  → `apps/parakeet/src/modules/lipedema-tracking/index.ts`

**Feature flag + nav:**

- [x] `lipedemaTracking` flag in `FEATURE_REGISTRY` (health,
      `defaultEnabled: false`).
  → `apps/parakeet/src/modules/feature-flags/model/features.ts`
- [x] Route `app/(tabs)/lipedema-tracking.tsx` wraps `TrackingScreen`
      with SafeAreaView + ScreenHeader + ScreenTitle. Gated by
      `useFeatureEnabled('lipedemaTracking')` with hooks-before-return.
  → `apps/parakeet/src/app/(tabs)/lipedema-tracking.tsx`
- [x] `(tabs)/_layout.tsx` registers the screen with `href: null` —
      reachable only via drawer.
  → `apps/parakeet/src/app/(tabs)/_layout.tsx`
- [x] `LeftDrawer` conditional entry (body-outline icon) behind the
      same flag.
  → `apps/parakeet/src/components/ui/LeftDrawer.tsx`

**`supabase/types.ts`:**

- [x] Hand-stubbed `lipedema_measurements` table block (Row / Insert /
      Update). Regenerates cleanly on `npm run db:types` after `db:reset`.
  → `supabase/types.ts`

## Dependencies

- [docs/features/nutrition/index.md](../nutrition/index.md) — this is
  the observability layer for the nutrition protocol; the two are
  complementary but independently toggleable.
