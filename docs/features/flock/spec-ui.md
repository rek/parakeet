# Spec: Flock UI & Navigation

**Status**: Implemented (10 Jun 2026)

**Domain**: UI

> Phase 3 of 3. Depends on [spec-data-foundation.md](./spec-data-foundation.md) and
> [spec-publish.md](./spec-publish.md).
>
> **As built:** `flock` flag in `feature-flags/model/features.ts`; route
> `app/(tabs)/flock.tsx` + hidden `Tabs.Screen` in `(tabs)/_layout.tsx`; drawer
> item in `components/ui/LeftDrawer.tsx`; `modules/flock/ui/{FlockScreen,FlockCard}.tsx`;
> hooks `useFlock` / `useFlockSharing`. The share toggle + consent live on the
> Flock screen header (the `ShareBanner`); the **Settings-screen duplicate toggle
> was deferred** to avoid bloating `settings.tsx` — the screen banner satisfies the
> consent requirement for v1.

## What This Covers

The read-only surface: a `flock` feature flag, a drawer entry, a `/(tabs)/flock` screen that
lists every sharing lifter's card (headline, Wilks + delta, streak), the first-open share
consent, and a Settings toggle. Rich per-lifter PR-history detail is **deferred** — friends
can't read each other's `achievements`/`session_logs`, so a tapped card expands only the data
already in the published row. A sanitized history projection is a future spec (design Open
Questions).

## Tasks

**`apps/parakeet/src/modules/feature-flags/model/features.ts`:**

- [ ] Add to `FEATURE_REGISTRY`: `{ id: 'flock', label: 'Flock', description: 'Shared PR feed for friends & family', category: 'advanced', defaultEnabled: false }` (mirrors the gym-partner flag; `'flock'` joins the `FeatureId` union automatically).

**`apps/parakeet/src/app/(tabs)/flock.tsx`** (thin route wrapper — copy `nutrition.tsx`):

- [ ] Guard on `useFeatureEnabled('flock')` (render null if off); `SafeAreaView` → `ScreenHeader` → `<FlockScreen />` from `@modules/flock`.

**`apps/parakeet/src/app/(tabs)/_layout.tsx`:**

- [ ] Register `<Tabs.Screen name="flock" options={{ href: null }} />` alongside the other hidden (drawer-only) routes — no visible bottom tab.

**`apps/parakeet/src/components/ui/LeftDrawer.tsx`:**

- [ ] Add `const flockEnabled = useFeatureEnabled('flock');` and a conditional `DrawerItem` (icon e.g. `people-outline` / a bird-ish glyph, label "Flock", `onPress={() => go('/(tabs)/flock')}`) next to the Nutrition / Lipedema items.

**`apps/parakeet/src/modules/flock/ui/FlockScreen.tsx`:**

- [ ] Consume the highlights list hook; render a `FlatList` of `FlockCard`s sorted by `published_at desc`; pull-to-refresh (invalidate the list query). Non-sharers simply aren't in the data (no ghost rows).
- [ ] Empty state when nobody shares yet (incl. "turn on sharing to join").
- [ ] First-open consent: if `flock_config.sharing_enabled` is null/false, show the explainer + "Share my highlights" toggle (what is / isn't shared — PRs, Wilks, streaks; **not** weights, RPE, or health data). Toggling on triggers the immediate publish from Phase 2.

**`apps/parakeet/src/modules/flock/ui/FlockCard.tsx`:**

- [ ] Render name + bird glyph (no avatar field exists in `profiles`), the `headline`, Wilks + delta arrow (▲/▬/▼ by `wilks_delta` sign), streak, and relative "Xh ago" from `published_at`. Theme colors only — no raw hex.

**`apps/parakeet/src/modules/flock/hooks/useFlock.ts` + `useFlockSharing.ts`:**

- [ ] `useFlock()` — list query hook.
- [ ] `useFlockSharing()` — read + mutation for `flock_config.sharing_enabled`; the mutation invalidates the config query and (on enable) publishes / (on disable) deletes the card. Screens never import `@tanstack/react-query` directly.

**`apps/parakeet/src/app/settings/` (Flock section):**

- [ ] Surface the same "Share my highlights" toggle in Settings (under Advanced), reusing `useFlockSharing`.

## Deferred (not this spec)

- Per-lifter PR-history detail view (needs a sanitized history projection — future spec).
- Kudos / reactions / comments / notifications (design Future section).

## Dependencies

- [spec-data-foundation.md](./spec-data-foundation.md), [spec-publish.md](./spec-publish.md).
- `@modules/feature-flags` (`useFeatureEnabled`), `components/ui/LeftDrawer`, `ScreenHeader`.

## Notes

- Verify query keys + invalidations before writing the screen (workflow §5 pre-implementation review).
- `// @spec docs/features/flock/spec-ui.md` at the top of each new non-trivial file.
