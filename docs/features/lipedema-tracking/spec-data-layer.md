# Spec: Lipedema-tracking data layer + entry UI

**Status**: Implemented

**Domain**: Data / User Config | UI

## What this covers

Table + module + entry screen for lipedema measurement logs (one row
per user per recorded_date; upsert semantics, expected cadence
weekly). RLS so only the owner reads/writes. Feature-flag gated off
by default. Date navigator + per-limb delta vs prior + tap-history-to-edit
make the form feel like a journal, not a database row.

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
- [x] `BEFORE UPDATE` trigger to bump `updated_at` automatically so any
      future writer that forgets to set it explicitly stays honest.
  → `supabase/migrations/20260504100000_lipedema_measurements_updated_at_trigger.sql`

**`apps/parakeet/src/modules/lipedema-tracking/`:**

- [x] `model/types.ts` — `LipedemaMeasurement`, `MeasurementDraft`,
      `Limb`, `Side`, `LIMB_LABELS`. Domain field names are camelCase
      (`painScore`, `swellingScore`, `*Mm`); snake_case stays at the
      DB column boundary inside the repository row mapper.
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
- [x] `lib/units.ts` — `cmStringToMm`, `mmToCmString`,
      `parseInProgressCmToMm`, `parseZeroToTen`. Pure. Unit tests
      cover round-trip, clamp, trim, null, and the in-progress-typing
      sub-1cm guard.
  → `apps/parakeet/src/modules/lipedema-tracking/lib/units.ts`
  → `apps/parakeet/src/modules/lipedema-tracking/lib/__tests__/units.test.ts`
- [x] `lib/trends.ts` — `limbTrend(rows, pick)`, `seriesDrift(series)`,
      `adjacentDelta(series)`, `priorValue(rows, pick, excludeDate?)`.
      `priorValue` powers the per-limb delta tag on the entry form.
      Each helper unit-tested.
  → `apps/parakeet/src/modules/lipedema-tracking/lib/trends.ts`
  → `apps/parakeet/src/modules/lipedema-tracking/lib/__tests__/trends.test.ts`
- [x] `application/draft.ts` — `emptyDraft`, `measurementToDraft`,
      `draftToUpsert`, `draftIsEmpty`. Pure. Tests cover round-trip,
      empty-check, and notes-only/blank discrimination.
  → `apps/parakeet/src/modules/lipedema-tracking/application/draft.ts`
  → `apps/parakeet/src/modules/lipedema-tracking/application/__tests__/draft.test.ts`
- [x] `ui/TrackingScreen.tsx` — date navigator + form + history.
      Preloads the selected day's entry exactly once per date change
      (ref-guarded so post-save invalidation never clobbers in-flight
      edits). Per-limb delta vs prior non-null value rendered next to
      each input. Tap any history card to load it back into the form.
      Pre-fill button copies last entry into a blank draft. Toast
      confirms save / delete. Alert-gated delete with error alert on
      failure (per `feedback_error_handling_screens.md`). Save error
      auto-clears on next field edit.
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
