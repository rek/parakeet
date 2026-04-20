# Feature: Nutrition protocols

**Status**: Implemented

**Date**: 20 Apr 2026

## Overview

Parakeet has a single primary user (female, lipedema-affected, living in
Nepal) and the strongest published dietary intervention for lipedema is
low-carb / ketogenic. Two parallel protocols are researched here — keto
(aggressive, evidence-backed) and Herbst's RAD (sustainable,
Mediterranean-derived, lymph-tonic) — plus Nepal-specific sourcing,
supplements, and lifestyle adjuncts. The whole catalog ships as a
read-only in-app reference behind a feature flag.

## Problem statement

- **Standard obesity interventions don't work on Rare Adipose
  Disorders.** The pathological adipose in lipedema does not respond to
  caloric restriction or bariatric surgery. Diet can reduce pain,
  swelling, and inflammation — but not every diet is equal.
- **The evidence base is thin and scattered.** Key anchors (Lundanes
  2024 RCT, Sørlie 2022 LIPODIET, Cannataro 2021 case, 2024 Nutrients
  SR, 2025 Nutrition Reviews scoping review) disagree on detail and
  are easy to miscite.
- **Nepal-specific adaptations matter.** Buffalo/yak dairy (A2), local
  produce (karela, methi, rayo, moringa), Daraz-available brands
  (Zenith, HK Vitals, MuscleBlaze, Calcima-K2) are all practical
  levers invisible to generic Western guidance.
- **The primary user is also a lifter.** The unique-to-parakeet angle
  is correlating diet adherence with training outcomes (Wilks, session
  density, soreness) — not replicating any-old nutrition app.

## User experience

### User flows

**Primary flow — read the protocol:**

1. User flips `nutrition` in Settings → Features.
2. Drawer shows a **Nutrition** entry with a leaf icon.
3. Tap → 6-tab screen: Overview, Foods, Supplements, Lifestyle,
   Compare, Sources.
4. Switch protocols (Keto / RAD) via the pill selector at the top.

**Secondary flow — look up a food:**

1. Foods tab → search box or status filter (Yes / Caution / No).
2. Grouped by category; notes explain edge cases (e.g. "A1 vs A2
   casein", "lean cuts only — contested, see rad.md Protein choices").

**Compare flow — where the protocols disagree:**

1. Compare tab → list of foods whose status differs between Keto
   and RAD, plus foods present in only one protocol.

### Visual design notes

- Tab bar is horizontal-scroll to fit six tabs on narrow screens.
- Status chips use existing theme colours (success / warning /
  danger muted).
- Evidence badges (A / B / C) map to existing theme tones
  (success / info / warning).
- Daily Rituals card on Overview pins the morning shot + superfoods
  (RAD-only categories) to the top.

## User benefits

**Single source of truth.** The diet isn't scattered across bookmarks and
chat threads. It's versioned (git), indexed (DB), and rendered in the
app.

**Evidence-honest.** Every supplement, every macro target, every
lifestyle item has an evidence grade. "No supplement has established
efficacy" is stated up front per the 2025 scoping review, so the user
can tell the difference between a well-grounded recommendation and a
case-report extrapolation.

**Nepal-first sourcing.** Every import-by-default assumption is
replaced with a Daraz-confirmed local brand where one exists.
Labdoor-certified omega-3, HK Vitals 370 mg-elemental magnesium
glycinate in a single tablet, Calcima-K2 as a combined D3+K2 form —
all noted with product-level specificity.

**Unified data pipeline.** One seed command works local and prod. CSV
→ DB via upsert+prune, idempotent. Edit a CSV, re-run the seed, the
UI updates.

## Open questions

- [ ] Should foods support multi-category (avocado = Fats + Fruits)?
      Current schema stores one. Deferred.
- [ ] Do we want intake logging (tap-to-mark daily ritual completion)?
      Earliest phase-2 candidate.
- [ ] Should training correlation overlay live under Nutrition or
      under a new "Insights" surface on Today / History? Open until
      phase-2.

## References

- Specs: [spec-data-layer](./spec-data-layer.md) ·
  [spec-ui](./spec-ui.md) ·
  [spec-evidence-calibration](./spec-evidence-calibration.md) ·
  [spec-nepal-sourcing](./spec-nepal-sourcing.md) ·
  [spec-prod-push](./spec-prod-push.md)
- Canonical handoff: [gh#199](https://github.com/rek/parakeet/issues/199)
- Primary evidence source: [2025 Nutrition Reviews scoping review](https://academic.oup.com/nutritionreviews/advance-article/doi/10.1093/nutrit/nuaf203/8342097)
- Primary RCT: [Lundanes 2024 — Obesity](https://onlinelibrary.wiley.com/doi/full/10.1002/oby.24026)
- Authoring layer lives in `tools/data/`; module lives in
  `apps/parakeet/src/modules/nutrition/`.
