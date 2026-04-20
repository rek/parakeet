# Spec: Nepal sourcing confirmation

**Status**: Implemented

**Domain**: Data / User Config

## What this covers

Every supplement row is tagged with a Nepal-sourcing category
(`local` / `import` / `food` / `mixed`). This spec records the
brand-level confirmations from Daraz.com.np (Nepal's dominant
e-commerce site) and the iHerb fallback list, plus the
tree-nut-allergy catch that affects the selenium food route.

## Tasks

**Tree-nut allergy — selenium food route blocked:**

- [x] Brazil nuts added to `rad.csv` as `no,ALLERGY` (tree nut).
      Consistent with existing allergy rows
      (almonds/walnuts/pistachios/hazelnuts/macadamia).
  → `tools/data/rad.csv`
- [x] Brazil nuts added to `keto.csv` as `no,ALLERGY`.
  → `tools/data/keto.csv`
- [x] Selenium row food_equivalent caveat: "N/A for this user
      (tree-nut allergy rules out Brazil nuts — standard food route)".
      Tablet-only path.
  → `tools/data/rad_supplements.csv`
- [x] `supplements.md` Selenium section updated: "not available to
      this user" callout; Bhumi Nepal Brazil Nuts noted as
      Daraz-stocked for users without the allergy.
  → `tools/data/supplements.md`

**Daraz Nepal brand confirmations — `import` → `local` in CSVs:**

- [x] **Magnesium glycinate** — Zenith Nutrition 600 mg (122 mg
      elemental) and HK Vitals (370 mg elemental / tab, full target
      in one pill). Nepal sourcing upgraded from import to local.
  → `tools/data/rad_supplements.csv`, `tools/data/keto_supplements.csv`
- [x] **Vitamin D3 + K2 combined** — Calcima-K2 (CCM + K2-MK7 + D3 +
      Zn) and Nutrela D2K (chewable). Upgraded to local.
  → `tools/data/rad_supplements.csv`, `tools/data/keto_supplements.csv`
- [x] **Omega-3 fish oil** — MuscleBlaze Omega 3 Gold 1300 mg
      (500 mg EPA + 400 mg DHA, Labdoor USA certified) and HK Vitals
      Triple Strength (525 mg EPA + 375 mg DHA). Labdoor-certified
      form confirmed locally; previous "always import for purity"
      assumption was wrong.
  → `tools/data/rad_supplements.csv`, `tools/data/keto_supplements.csv`

**Not on Daraz — iHerb or local pharmacy:**

- [x] Standalone selenium tablets — multivitamins-with-selenium
      only; dose too low. iHerb for 200 mcg standalone.
  → `tools/data/rad_supplements.csv`, `tools/data/supplements.md`
- [x] Butcher's Broom — iHerb only.
  → `tools/data/rad_supplements.csv`
- [x] Diosmin + Hesperidin (Daflon) — not on Daraz; local pharmacy
      route. Confirmed composition: Servier India, 450 mg diosmin +
      50 mg hesperidin per tablet. Distributed across South Asia for
      CVI / hemorrhoids.
  → `tools/data/rad_supplements.csv`, `tools/data/supplements.md`
- [x] Sublingual B12 methylcobalamin — local pharmacy or iHerb.
  → `tools/data/rad_supplements.csv`
- [x] C8 MCT oil — iHerb only (Daraz has coconut-derived blends).
  → `tools/data/keto_supplements.csv`

**`supplements.md` Nepal sourcing section:**

- [x] Daraz-confirmed brand table (with dose-per-tab details).
  → `tools/data/supplements.md`
- [x] Not-on-Daraz table with fallback routes.
  → `tools/data/supplements.md`
- [x] iHerb shipping note (180+ countries, air freight, DDP checkout
      for pre-paid customs duties).
  → `tools/data/supplements.md`

**Cross-session reference:**

- [x] Memory captured at `memory/reference_nutrition_sourcing_nepal.md`
      so future sessions don't re-research. Tree-nut-allergy gotcha
      flagged explicitly to prevent regression.
  → `/home/adam/.claude/projects/-home-adam-dev-parakeet/memory/reference_nutrition_sourcing_nepal.md`

## Dependencies

- [spec-evidence-calibration.md](./spec-evidence-calibration.md) — the
  rows being annotated with sourcing are the same rows calibrated
  there.
