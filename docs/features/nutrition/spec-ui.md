# Spec: Nutrition UI

**Status**: Implemented

**Domain**: UI

## What this covers

6-tab Nutrition screen composition, themed markdown rendering of
`description_md`, runtime extraction of sources from MD, cross-protocol
compare view. Feature flag gating on the drawer entry and the route.

## Tasks

**`apps/parakeet/src/modules/nutrition/ui/`:**

- [x] `NutritionScreen.tsx` — ProtocolSelector + 6-tab horizontal
      scroll bar (Overview / Foods / Supplements / Lifestyle /
      Compare / Sources) + per-tab section component
  → `apps/parakeet/src/modules/nutrition/ui/NutritionScreen.tsx`
- [x] `ProtocolSelector.tsx` — pill-style protocol switcher
  → `apps/parakeet/src/modules/nutrition/ui/ProtocolSelector.tsx`
- [x] `StatusChip.tsx` — yes / caution / no chip with theme tones
  → `apps/parakeet/src/modules/nutrition/ui/StatusChip.tsx`
- [x] `FoodSection.tsx` — search TextInput + status filter
      (all / yes / caution / no) + category groups
  → `apps/parakeet/src/modules/nutrition/ui/FoodSection.tsx`
- [x] `SupplementSection.tsx` — three filter rows (Tier / Evidence
      grade / Nepal sourcing) + card layout with evidence badges
  → `apps/parakeet/src/modules/nutrition/ui/SupplementSection.tsx`
- [x] `LifestyleSection.tsx` — category icons (Ionicons for
      compression, manual_therapy, movement, sleep, stress) + frequency
      badges (daily / weekly / as_needed)
  → `apps/parakeet/src/modules/nutrition/ui/LifestyleSection.tsx`
- [x] `DailyRituals.tsx` — pins morning_shot + rad_superfoods
      categories to Overview for RAD protocol
  → `apps/parakeet/src/modules/nutrition/ui/DailyRituals.tsx`
- [x] `CompareSection.tsx` — loads both protocol bundles; computes
      disagreements + single-protocol foods via `Map` keyed by
      `displayName|category`
  → `apps/parakeet/src/modules/nutrition/ui/CompareSection.tsx`
- [x] `SourcesSection.tsx` — numbered clickable cards with hostname
      display; `Linking.openURL` on tap
  → `apps/parakeet/src/modules/nutrition/ui/SourcesSection.tsx`
- [x] `index.ts` — module public API (barrel for `@modules/nutrition`)
  → `apps/parakeet/src/modules/nutrition/index.ts`

**`apps/parakeet/src/modules/nutrition/lib/`:**

- [x] `markdown.tsx` — themed wrapper around
      `react-native-markdown-display` (headings, lists, tables,
      blockquotes, code, hr all mapped to parakeet theme)
  → `apps/parakeet/src/modules/nutrition/lib/markdown.tsx`
- [x] `extract-sources.ts` — runtime regex-extraction of
      `[title](url)` links under the `## Sources` heading; dedupes
      by URL; case-insensitive heading match; http(s)-only
  → `apps/parakeet/src/modules/nutrition/lib/extract-sources.ts`
- [x] Unit tests (11): null/empty input, absent heading, dedup by
      URL, stops at next h1/h2, continues past h3+, http(s)-only,
      CRLF, whitespace trimming
  → `apps/parakeet/src/modules/nutrition/lib/__tests__/extract-sources.test.ts`

**`apps/parakeet/src/modules/nutrition/hooks/`:**

- [x] `useNutrition.ts` — `useProtocols()`, `useProtocolBundle(slug)`
      thin wrappers around queryOptions factories
  → `apps/parakeet/src/modules/nutrition/hooks/useNutrition.ts`

**`apps/parakeet/src/app/(tabs)/nutrition.tsx`:**

- [x] Route with SafeAreaView + ScreenHeader + HeaderMenuButton +
      ScreenTitle. Hooks-before-return gate: `useFeatureEnabled('nutrition')`
      called before `useMemo`; `return null` after all hooks if disabled.
  → `apps/parakeet/src/app/(tabs)/nutrition.tsx`

**`apps/parakeet/src/app/(tabs)/_layout.tsx`:**

- [x] Register as hidden tab (`href: null`) — reachable only via
      drawer.
  → `apps/parakeet/src/app/(tabs)/_layout.tsx`

**`apps/parakeet/src/components/ui/LeftDrawer.tsx`:**

- [x] Drawer entry `nutrition-outline` icon → `/(tabs)/nutrition`,
      conditionally rendered on `useFeatureEnabled('nutrition')`.
  → `apps/parakeet/src/components/ui/LeftDrawer.tsx`

## Dependencies

- [spec-data-layer.md](./spec-data-layer.md) — UI reads through the
  repository layer defined there.
