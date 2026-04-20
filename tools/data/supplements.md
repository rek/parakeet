# Supplements — Lipedema / RAD Protocol (Nepal Context)

Companion to `diets.md`, `rad.md`, `keto.md`, and `labs.md`. This file
covers pill/powder/tincture supplements that sit alongside the food
allowlist. Food-sourced micronutrients (omega-3 from sardines, rutin
from goji, curcumin from turmeric) live in `rad.csv`; titrated
therapeutic doses live here and in `rad_supplements.csv` /
`keto_supplements.csv`.

## Headline caveat

The **2025 Nutrition Reviews scoping review** is explicit:

> The usefulness of any dietary supplement in treating lipedema has
> not been established, based on evidence from the current literature.

Supplements address **deficiencies induced by the chosen diet** and
conditions that coexist with lipedema (inflammation, vascular
fragility, low D3), not the disease itself. Durable improvement comes
from the diet + lymphatic lifestyle; supplements are the supporting
cast.

## Evidence tiers

Aligned with the 2025 scoping review classification:

- **Suggested** — case-report evidence plus strong mechanistic
  rationale for lipedema. Currently only **DHA/EPA (1–2 g/day)** and
  **Vitamin C (500–1000 mg/day)**.
- **Evaluate as needed** — use when deficiency is documented or
  clinically indicated; don't take blindly. D3, K2, selenium, B12,
  magnesium, zinc, calcium (on keto), polyphenols.
- **Weak / anecdotal** — diosmin+hesperidin, butcher's broom, rutin,
  berberine, exogenous ketones. Mechanism is plausible; lipedema-
  specific data is thin.

Internal grade letters (A/B/C) in the CSVs map approximately to these
tiers — A for the strongest diet-adjacent evidence (omega-3, vitamin C,
electrolyte supplementation on keto), B for mechanistic/deficiency-
correction rationale, C for weak / case-only evidence.

## Nepal sourcing key

- **🇳🇵 Local** — reliably available via **Daraz.com.np** (Nepal's
  dominant e-commerce site) or Kathmandu pharmacies.
- **📦 Import** — iHerb (ships to Nepal) / Amazon via forwarder /
  traveller bring-back. Used when Daraz doesn't stock the specific
  form.
- **🌱 Food** — obtainable via diet, no pill needed.

### Daraz Nepal — brand-level confirmations (checked 2026-04-20)

| Supplement | Daraz brand options |
| --- | --- |
| **Magnesium glycinate** | Zenith Nutrition 600 mg (122 mg elemental); HK Vitals 1682 mg total / 370 mg elemental (full target dose in 1 tab). |
| **Vitamin D3 + K2 (combined)** | Calcima-K2 (CCM + K2-MK7 + D3 + Zn); Nutrela D2K chewables. Combined form is cheaper and more convenient than separate bottles. |
| **Omega-3 fish oil** | MuscleBlaze Omega 3 Gold 1300 mg (500 mg EPA + 400 mg DHA, Labdoor USA certified); HK Vitals Triple Strength (525 mg EPA + 375 mg DHA). **Pick Labdoor-certified for heavy-metal purity.** |
| **Brazil nuts (selenium food route)** | Bhumi Nepal Brazil Nuts 500 g — stocked. **Not applicable to this user (tree-nut allergy).** |

### Daraz — not stocked (use iHerb or local pharmacy)

| Supplement | Alternative |
| --- | --- |
| **Standalone selenium tablets** | Multivitamins-with-selenium sold on Daraz but concentration too low; iHerb for 200 mcg standalone. |
| **Butcher's broom** | iHerb. |
| **Diosmin + Hesperidin (Daflon)** | Not on Daraz — local pharmacy route. Daflon (Servier India, 450 + 50 mg per tab) is regional-distribution across South Asia; widely stocked in Kathmandu pharmacies for hemorrhoids / varicose veins (same compound). |
| **Sublingual B12 methylcobalamin** | Local pharmacy (injectable + sublingual routinely stocked) or iHerb. |
| **C8 MCT oil** | iHerb — coconut-derived MCT blends exist on Daraz but not pure C8. |

**iHerb shipping to Nepal**: confirmed supported (all 180+ countries
via air freight). Customs duties may apply — DDP checkout option pre-
pays duties to avoid carrier-side handling fees.

---

## Core stack

### Vitamin D3

| Field | Value |
| --- | --- |
| Dose | 2000–5000 IU/day, titrated to blood level (target 40–60 ng/mL) |
| Co-factor | Take with fat-containing meal; pair with K2 (MK-7 100 mcg) for calcium routing |
| Rationale | Near-universal deficiency in RAD patients. Immune, bone, neuromuscular, mood. Also modulates adipose inflammation. |
| Evidence | **B** — deficiency well documented in lipedema cohorts; supplementation effect on lipedema-specific outcomes less well studied. |
| Food equivalent | Oily fish gives some but not therapeutic dose. Sun exposure helps but inconsistent. |
| Nepal sourcing | **🇳🇵 Local** — widely available; check IU potency on label. Daraz stocks combined D3+K2 products (Calcima-K2, Nutrela D2K) — cheaper than buying two bottles. |
| Status | ✓ In `rad_supplements.csv`. |

### Vitamin C — *Suggested tier*

| Field | Value |
| --- | --- |
| Dose | 500–1000 mg/day, divided into 2 doses. Cannataro 2021 keto protocol used 1 g/day. |
| Rationale | Collagen synthesis, anti-inflammatory / antioxidant, capillary integrity. Classified as **Suggested** by the 2025 Nutrition Reviews scoping review — one of only two supplements at that tier for lipedema (alongside DHA/EPA). |
| Evidence | **B** — case-report + strong mechanistic basis. |
| Food equivalent | **🌱 Citrus, guava, amla, bell peppers, kiwi.** Food form is adequate for maintenance; supplement for therapeutic anti-inflammatory dose. |
| Nepal sourcing | **🇳🇵 Local** — widely stocked (both ascorbic acid and food-based). |
| Cautions | Very high dose (>2 g/day) can cause GI upset / loose stool; dose-divide. Chemotherapy: do not use without oncology sign-off. |
| Status | ✓ In `rad_supplements.csv` and `keto_supplements.csv`. |

### Selenium

| Field | Value |
| --- | --- |
| Dose | 200 mcg/day (do not exceed 400 mcg — toxicity risk) |
| Rationale | Thyroid function, antioxidant (glutathione peroxidase). ~47% of lipedema patients deficient in published series. Cho/Herbst retrospective case (n=1) used 400 mcg/day + butcher's broom → 70–79% leg volume reduction. |
| Evidence | **C** — one retrospective case study; plausible mechanism. 2025 scoping review cites conservative 45–60 mcg range for routine use. |
| Food equivalent | 2 Brazil nuts ≈ 200 mcg is the classical food route — **not available to this user** (tree-nut allergy; Brazil nuts are marked `no,ALLERGY` in `rad.csv`). Tablet only. |
| Nepal sourcing | Standalone selenium tablets not widely stocked on **Daraz Nepal** (mostly found inside multivitamin combos). Standalone: **📦 Import** (iHerb). Bhumi Nepal Brazil Nuts 500g *is* stocked on Daraz for users without the allergy. |
| Status | ✓ Selenium in `rad_supplements.csv`. Brazil nuts in `rad.csv` + `keto.csv` as `no,ALLERGY`. |

### Diosmin (often as Diosmin + Hesperidin, "Daflon" or equivalent)

| Field | Value |
| --- | --- |
| Dose | 500–600 mg, 1–2×/day |
| Rationale | Citrus bioflavonoid. Venous/lymphatic tonic, anti-inflammatory, reduces capillary fragility and edema. Standard of care for chronic venous insufficiency; applied to lipedema for similar mechanisms. |
| Evidence | **C** for lipedema specifically (extrapolated from CVI evidence); **B** for chronic venous insufficiency. |
| Food equivalent | Small amounts in citrus peel; not therapeutic. |
| Nepal sourcing | **🇳🇵 Local** — Daflon (Servier India: 450 mg diosmin + 50 mg hesperidin per tablet) stocked across South Asia for hemorrhoids / varicose veins (same compound). 1–2 tabs/day. |
| Status | ✓ In `rad_supplements.csv`. |

### Butcher's Broom (*Ruscus aculeatus*)

| Field | Value |
| --- | --- |
| Dose | Label dose — typically 150–300 mg extract 2×/day |
| Rationale | Vasoconstrictor of venous capillaries, reduces edema. Paired with selenium in Cho/Herbst retrospective lipedema study (case used **1 g/day**; CSV recommends a more conservative 300 mg 2×/day). |
| Evidence | **C** — one retrospective case study for lipedema; no RCT. |
| Nepal sourcing | **📦 Import** — not typically stocked locally. |
| Status | ✓ In `rad_supplements.csv`. |

### Rutin

| Field | Value |
| --- | --- |
| Dose | 500 mg/day (often combined with vitamin C for absorption) |
| Rationale | Flavonoid that strengthens capillary walls, reduces bruising and vascular fragility. Same family as diosmin/hesperidin. |
| Evidence | **C** — mechanistic, used historically for venous/lymphatic issues. |
| Food equivalent | **🌱 Goji berries, bee pollen, buckwheat, capers, asparagus.** CSV already lists goji and bee pollen with rutin notes. |
| Nepal sourcing | **📦 Import** for standalone rutin. |
| Status | **Food-covered; consider pill only if capillary fragility / bruising persists.** |

### Vitamin B12 (methylcobalamin)

| Field | Value |
| --- | --- |
| Dose | 1000 mcg/day sublingual, or weekly 1000 mcg IM if deficient |
| Rationale | Nerve function, energy, red blood cells. Often low in RAD patients. Higher risk if red meat is restricted (the Herbst-aligned position). |
| Evidence | **C** for RAD-specific; **A** for deficiency correction generally. |
| Food equivalent | Animal products only (meat, fish, eggs, dairy). Fermented foods do **not** provide reliable B12. |
| Nepal sourcing | **🇳🇵 Local** — sublingual and injectable both available. |
| Status | ✓ In `rad_supplements.csv`. |

### Magnesium

| Field | Value |
| --- | --- |
| Dose | 300–400 mg elemental/day. Split or at bedtime. |
| Forms | **Glycinate** (calming, best absorbed), **citrate** (also laxative), **malate** (energy). Avoid oxide (poorly absorbed). |
| Rationale | Muscle, sleep, insulin sensitivity, vascular tone. Commonly depleted under stress / ketogenic adaptation. |
| Evidence | **B** per 2025 scoping review ("evaluate" tier for lipedema); **A** for deficiency correction generally. |
| Food equivalent | Leafy greens, seeds, dark chocolate — contributory, often not sufficient. |
| Nepal sourcing | **🇳🇵 Local** — Daraz stocks **Zenith Nutrition 600 mg** (122 mg elemental) and **HK Vitals** (370 mg elemental per tab — hits full target dose in one pill). Citrate more widely available in Kathmandu pharmacies too. |
| Status | **Already in rad.csv (both glycinate and citrate).** ✓ |

---

## Already food-sourced (listed here for completeness)

| Nutrient | Food source in rad.csv | Why no pill |
| --- | --- | --- |
| Omega-3 EPA/DHA | Salmon, mackerel, sardines, yak cheese | Whole-food fish delivers therapeutic dose + co-nutrients |
| ALA (plant omega-3) | Flaxseed, chia, hemp | Conversion to EPA/DHA is limited but contributory |
| Curcumin | Turmeric + black pepper (morning shot, condiments) | Piperine potentiates absorption; food form adequate for most. Pill (curcumin-phospholipid or meriva) only if anti-inflammatory effect insufficient. |
| Rutin / quercetin | Goji berries, bee pollen | See above |
| Electrolytes (Na) | Himalayan pink salt in morning water | Intentional for keto/low-carb electrolyte balance |
| Iodine | Sea vegetables, fish (if consumed) | Nepal iodized salt also provides baseline |

---

## Optional / situational

| Supplement | When to consider |
| --- | --- |
| **Vitamin K2 (MK-7)** | Always if taking D3 long-term — directs calcium to bones, away from arteries. 100 mcg/day. 📦 Import. |
| **Omega-3 fish oil (EPA/DHA)** — *now core* | 1–2 g combined EPA+DHA/day (Cannataro 2021 used 3 g). One of the two "Suggested" tier supplements per 2025 scoping review. 🇳🇵 Local via Daraz (MuscleBlaze Omega 3 Gold, Labdoor USA certified; HK Vitals Triple Strength). |
| **Calcium** — *core on long-term keto* | 1000–1200 mg/day total intake (food first). Low-carb diets raise urinary calcium excretion (bone-loss flag from 2025 scoping review). Use citrate form; space 4h from thyroid hormone / iron / bisphosphonates. |
| **Probiotic** | If gut dysbiosis symptoms. Multi-strain. Or lean on kefir/yoghurt (already in CSV). |
| **Zinc** | If picolinate form, 15–30 mg/day. Monitor copper balance if long-term. 🇳🇵 Local. |
| **CoQ10 (ubiquinol)** | If fatigue / post-exertional malaise. 100–200 mg/day. 📦 Import. |
| **MCT oil (C8 preferred)** — *keto only* | Optional keto accelerant. Start ½ tsp, build to 1 tbsp; GI upset dose-dependent. 📦 Import. |
| **Berberine** — *keto only* | 500 mg 2–3×/day with meals if fasting insulin / glucose not normalising on keto alone. Interacts with metformin. 📦 Import. |
| **Psyllium husk** — *keto only* | 5–10 g/day during weeks 1–4 for constipation. Take with plenty of water. 🇳🇵 Local. |

---

## Contraindications and drug interactions

Flag for a clinician conversation before starting if you're on any of
the following. Non-exhaustive — this is decision-support, not a
pharmacology reference.

| Supplement | Interacts with | Effect |
| --- | --- | --- |
| **Vitamin K2 (MK-7)** | Warfarin / Coumadin | Shifts INR even at low doses. Never start without telling the prescriber. |
| **Diosmin + Hesperidin (Daflon)** | Anticoagulants (warfarin, DOACs), antiplatelets (aspirin, clopidogrel) | Theoretical additive bleeding risk. Caution with bleeding disorders. |
| **Butcher's Broom** | Alpha-blockers, MAO inhibitors | Vasoconstrictor; BP changes possible. Pregnancy: avoid (no safety data). |
| **Berberine** | Metformin, sulfonylureas, insulin | Additive glucose lowering → risk of hypoglycemia. |
| **Omega-3 fish oil** | Anticoagulants | High-dose (>3 g/day) additive bleeding risk. Typical 1–2 g/day fine. |
| **Magnesium** | Bisphosphonates, tetracyclines, quinolones, thyroid hormone | Binds these drugs — space 2–4h apart. |
| **Calcium** | Thyroid hormone, iron, bisphosphonates | Same binding concern — space 4h apart. |
| **Selenium** | High-dose selenium + statins | Selenium >400 mcg/day can mask statin-related muscle issues. Stay ≤200 mcg unless directed. |
| **Zinc** | Copper | Long-term high-dose zinc depletes copper. Monitor or take a low-dose copper balancer. |
| **Vitamin C (high dose)** | Chemotherapy | Do not use without oncology sign-off. |
| **Vitamin D3 (high dose)** | Calcium channel blockers, thiazide diuretics | Risk of hypercalcemia at very high D3 + these drugs. |

## Pregnancy and breastfeeding

Lipedema is hormonally triggered — pregnancy is both a common onset
window and a time when the protocol needs adjustment.

- **Ketogenic diet is not routinely recommended in pregnancy.** A more
  conservative low-GI Mediterranean pattern (75–100g carb/day) is the
  cautious default. Discuss with OB/GYN.
- **Safe / supported in pregnancy**: vitamin D (at prenatal dose),
  B12, omega-3, magnesium, iron, choline, folate. Most of these are
  already prenatal-vitamin components.
- **Avoid in pregnancy**: Diosmin / Butcher's Broom / Berberine / MCT
  oil at loading doses / exogenous ketones / high-dose vitamin A.
- **Breastfeeding**: omega-3, D3, B12 continue; avoid berberine.

## Lab monitoring

Every supplement recommendation here is a candidate for individual
titration. The companion `labs.md` lists the biomarkers worth
tracking before starting and at follow-up, including the **low-carb
urinary calcium / bone-loss flag** raised by the 2025 scoping review.

---

## Sources

- Cho S, Atwood JE. *Peripheral edema.* Am J Med. 2002. (Background on
  venous/lymphatic mechanisms.)
- Cho S, Kim HJ, Kim P, Jung ST. *Butcher's Broom and Selenium Improve
  Lipedema: A Retrospective Case Study.*
  [ResearchGate](https://www.researchgate.net/publication/271097697_Bucher's_Broom_and_Selenium_Improve_Lipedema_A_Retrospective_Case_Study)
- Herbst KL. *Medicine and Supplements for People with Lipedema and
  Dercum's Disease (DD).*
  [PDF — lipedemaitalia.info](http://lipedemaitalia.info/wp-content/uploads/2020/07/medicine-and-supplement-for-people-with-lipedema-and-DD-Herbst.pdf)
- *Nutritional Supplements and Lipedema: Scientific and Rational Use.*
  [MDPI](https://www.mdpi.com/1661-3821/2/4/20)
- *Diet & Supplement Recommendations for Lipedema.*
  [lipedemaspecialist.com](https://www.lipedemaspecialist.com/2022/01/17/diet-supplement-recommendations-for-lipedema/)
