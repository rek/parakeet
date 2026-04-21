# Spec: Macro targets + per-food USDA macros

**Status**: Implemented

**Domain**: Training Engine | Data / User Config | UI

## What this covers

Daily kcal + protein/fat/carb targets on the Nutrition Overview,
protocol-driven (keto or RAD) and adapting to the lifter's body
composition. Also lands the per-food macro catalog (USDA SR Legacy
+ manual Korean) as the foundation for later phase-2 work (intake
logging, meal planner, training correlation).

All numeric constants and formulas are documented in
[`docs/domain/nutrition.md`](../../domain/nutrition.md) — update both
docs and the code together.

## Tasks

**`supabase/migrations/`:**

- [x] `20260421100000_extend_profiles_body_comp.sql` — adds
      `height_cm`, `lean_mass_kg`, `activity_level`, `goal` to
      `profiles`. Check constraints on the enums.
  → `supabase/migrations/20260421100000_extend_profiles_body_comp.sql`
- [x] `20260421100001_create_diet_food_nutrition.sql` —
      `diet_food_nutrition` table keyed on `diet_foods.id`
      (kcal/protein/fat/carb/fiber per 100g). RLS read-all.
  → `supabase/migrations/20260421100001_create_diet_food_nutrition.sql`

**`tools/data/`:**

- [x] `food_nutrition.csv` — 144 rows. USDA SR Legacy via the
      importer + 5 manual rows (doenjang, gochujang, gochugaru,
      japchae glass noodles, homemade kombucha). 35 canonicals
      intentionally skipped (allergens / status=no / groups /
      supplements — no macro meaning).
  → `tools/data/food_nutrition.csv`
- [x] `food_nutrition_unmatched.txt` — human-visible record of which
      canonicals were skipped and why.
  → `tools/data/food_nutrition_unmatched.txt`

**`tools/scripts/import-usda-nutrition.ts`:**

- [x] Reads USDA SR Legacy bulk CSV (`food.csv`, `nutrient.csv`,
      `food_nutrient.csv`) + the diet allowlists + outputs
      `food_nutrition.csv` with confidence + description columns.
  → `tools/scripts/import-usda-nutrition.ts`
- [x] `FORCE_FDC` map — hard-pin USDA fdc_id for foods where fuzzy
      matching picks weirdly (snack crackers, branded items,
      concentrates). Added after a review pass caught ~30 bogus
      matches (salmon→oil, rice→cracker, etc.).
  → `tools/scripts/import-usda-nutrition.ts:FORCE_FDC`
- [x] `SKIP_MACROS` set — canonicals that don't need macro data
      (allergens, groups, supplements, status=no processed rows).
  → `tools/scripts/import-usda-nutrition.ts:SKIP_MACROS`
- [x] `PENALTY_TOKENS` + raised `MIN_CONFIDENCE` (70) — score
      calibration that keeps the fuzzy matcher conservative.
  → `tools/scripts/import-usda-nutrition.ts:PENALTY_TOKENS`
- [x] Re-runnable: preserves existing `food_nutrition.csv` rows for
      hand-validated entries; only re-writes unmatched or missing.
- [x] New `npm run db:import:usda` script.
  → `package.json`
- [x] `tools/data/usda/` gitignored — users re-download from
      `fdc.nal.usda.gov/download-datasets.html`.
  → `.gitignore`

**`tools/scripts/lib/parse-diet-csv.ts`:**

- [x] `parseNutritionCsv(text)` — header-tolerant (accepts the
      importer's trailing `confidence` / `usda_description` columns).
      Validates source enum, nulls empty optionals, line-numbered
      error messages.
  → `tools/scripts/lib/parse-diet-csv.ts:parseNutritionCsv`
- [x] 9 unit tests covering happy path, extra columns tolerance, null
      fiber, null source_id, invalid source, non-numeric macros,
      header mismatch, default serving_g, every source enum value.
  → `tools/scripts/lib/__tests__/parse-diet-csv.test.ts`

**`tools/scripts/seed-diet-protocols.ts`:**

- [x] Step 5 reads `food_nutrition.csv`, upserts+prunes into
      `diet_food_nutrition`. Canonical normalised on both sides of
      the food_id lookup; empty-keep-list guard on the prune so
      `not ('food_id', 'in', '()')` can't generate invalid PostgREST.
  → `tools/scripts/seed-diet-protocols.ts:main`

**`apps/parakeet/src/modules/nutrition/lib/macro-targets.ts`:**

- [x] `computeMacroTargets({ bodyweight, sex, age?, height?,
      lean_mass?, activity?, goal?, protocol, training_day? })` pure
      function. BMR cascade: Katch-McArdle → Mifflin-St Jeor →
      bodyweight fallback. TDEE via activity multiplier, goal delta.
      Keto hard carb cap (50 g total / 20 g net), fat clamped ≥0.
      RAD 40% fat, protein g/kg, residual carb. Training-day +10%
      protein.
  → `apps/parakeet/src/modules/nutrition/lib/macro-targets.ts:computeMacroTargets`
- [x] 18 unit tests covering all three BMR methods, activity scaling,
      cut/maintain/bulk deltas, keto ceiling + fat clamp,
      training-day × lean-mass composition, low_confidence flag,
      zero-bodyweight boundary.
  → `apps/parakeet/src/modules/nutrition/lib/__tests__/macro-targets.test.ts`

**`apps/parakeet/src/modules/nutrition/hooks/useMacroTargets.ts`:**

- [x] Hook reads `useProfile`, narrows missing fields, calls the pure
      fn. Returns `{ target, missing, isLoading }` for the UI.
  → `apps/parakeet/src/modules/nutrition/hooks/useMacroTargets.ts`

**`apps/parakeet/src/modules/nutrition/ui/MacroTargetsCard.tsx`:**

- [x] Overview tab card: kcal + 3 macro cells + method label (BMR +
      TDEE) + low-confidence badge + "complete your profile" empty
      state. Mounted in `NutritionScreen` on the Overview tab for
      protocols `keto` and `rad`.
  → `apps/parakeet/src/modules/nutrition/ui/MacroTargetsCard.tsx`

**`apps/parakeet/src/modules/nutrition/ui/CalculatorSection.tsx`:**

- [x] New "Calculator" tab on `NutritionScreen` — manual what-if tool.
      Inputs default from the lifter's profile; user can override any
      field (bodyweight, sex, age, height, lean mass, activity, goal,
      training-day toggle, pinned kcal). Live output. Shows "pinned"
      badge + derived-vs-pinned delta when `kcal_override` is applied.
      Powerlifter-calibrated: defaults activity to `active` with an
      explicit hint that the general-population multipliers undercount
      heavy-compound training load.
  → `apps/parakeet/src/modules/nutrition/ui/CalculatorSection.tsx`

**`apps/parakeet/src/modules/nutrition/lib/macro-targets.ts` — kcal_override:**

- [x] Optional `kcal_override` input. When set (>0), bypasses BMR ×
      activity × goal and uses the pinned value as `kcal` directly.
      BMR + TDEE are still computed for display. Output gains a
      `kcal_overridden: boolean` flag surfaced as a "pinned" UI badge.
  → `apps/parakeet/src/modules/nutrition/lib/macro-targets.ts:computeMacroTargets`
- [x] 4 new override tests (override pins kcal, null/0 fall back,
      BMR+TDEE preserved for display, 2000 kcal × 70 kg hand-math
      check).
  → `apps/parakeet/src/modules/nutrition/lib/__tests__/macro-targets.test.ts`

**`apps/parakeet/src/modules/profile/`:**

- [x] `Profile` interface + `UpdateProfileInput` extended with the 4
      new fields.
  → `apps/parakeet/src/modules/profile/application/profile.service.ts`
- [x] `getProfileById` selects the new columns; service layer
      normalises `activity_level` / `goal` via type predicates
      (no `as` casts).
  → `apps/parakeet/src/modules/profile/data/profile.repository.ts`
- [x] `useSaveProfile` accepts the new fields through
      `SaveProfileArgs` and persists via `updateProfile`.
  → `apps/parakeet/src/modules/profile/hooks/useSaveProfile.ts`

**`apps/parakeet/src/app/profile/index.tsx`:**

- [x] New "Body composition & activity" card: height (cm), lean mass
      (kg) with a DEXA-preferred helper note (bioimpedance unreliable
      on lipedema-affected limbs), activity-level picker (5 options),
      goal picker (3 options). All optional.
  → `apps/parakeet/src/app/profile/index.tsx`

**`apps/parakeet/src/modules/nutrition/index.ts`:**

- [x] Public API barrel re-exports `useMacroTargets`, `MacroTargetsCard`,
      `computeMacroTargets`, `MacroTargetDefaults`, and the
      `MacroTarget` / `MacroTargetInput` / `DietProtocolSlug` types.
  → `apps/parakeet/src/modules/nutrition/index.ts`

**`docs/domain/nutrition.md`:**

- [x] Single source of truth for BMR formulas, activity multipliers,
      goal deltas, protocol splits, protein g/kg, training-day bump,
      keto ceiling. Cross-linked from `docs/domain/README.md`.
  → `docs/domain/nutrition.md`

## Dependencies

- [spec-data-layer.md](./spec-data-layer.md) — the `diet_foods` table
  this nutrition row references; the base seed pipeline being
  extended.
- [spec-ui.md](./spec-ui.md) — the `NutritionScreen` tab host where
  the new card mounts.
