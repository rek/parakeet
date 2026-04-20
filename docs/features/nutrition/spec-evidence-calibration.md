# Spec: Evidence calibration

**Status**: Implemented

**Domain**: Data / User Config

## What this covers

Every numeric claim in the nutrition catalog — macro targets, supplement
doses, evidence grades — is traceable to a cited source. This spec
records how the evidence is graded and what the anchor sources are. The
calibration pass corrected a Cannataro-vs-Lundanes miscitation and
rebased supplement tiers against the 2025 Nutrition Reviews scoping
review.

## Tasks

**Anchor sources captured in `keto.md` + `rad.md` Sources sections:**

- [x] **Lundanes 2024** — *Effect of a low-carbohydrate diet on pain
      and quality of life in female patients with lipedema: a
      randomized controlled trial* (Obesity, Wiley). n=70, 8 weeks,
      −1.1 VAS pain (p=0.009) **independent of weight loss**. The
      primary RCT evidence for low-carb → pain reduction in lipedema.
  → `tools/data/keto.md`, `tools/data/rad.md`
- [x] **Sørlie 2022** — LIPODIET pilot (Clinical Nutrition ESPEN).
      n=9, 7-week LCHF (70–75% fat / 5–10% carb / 20% protein), VAS
      pain −2.3 cm (p=0.018), weight −4.6 kg (p<0.001). Supporting
      pilot.
  → `tools/data/keto.md`, `tools/data/rad.md`
- [x] **Cannataro 2021** — **single-case** 22-month follow-up
      (Healthcare). n=1, hypothesis-generating, not RCT. Previously
      miscited as n=70 RCT — fixed.
  → `tools/data/keto.md`, `tools/data/rad.md`
- [x] **2024 Nutrients SR + meta-analysis** — 7 studies, n=329,
      positive effects on anthropometric + body-composition metrics.
  → `tools/data/keto.md`, `tools/data/rad.md`
- [x] **2025 Nutrition Reviews scoping review** — current
      gold-standard overview. German DGPL S2k guideline: 94.7%
      expert consensus for keto. **No supplement has established
      efficacy** — only DHA/EPA + Vitamin C are "Suggested" tier.
  → `tools/data/keto.md`, `tools/data/rad.md`, `tools/data/supplements.md`

**Evidence-grade recalibration in `rad_supplements.csv`:**

- [x] Selenium: B → C. Scoping-review conservative dose 45–60 mcg;
      Cho/Herbst case used 400 mcg; CSV keeps 200 mcg middle with
      explicit upper-limit note.
  → `tools/data/rad_supplements.csv`
- [x] Diosmin+Hesperidin: B → C for lipedema specifically. Kept B
      for CVI (where the evidence is strong).
  → `tools/data/rad_supplements.csv`
- [x] Butcher's Broom: B → C. Only retrospective case evidence.
  → `tools/data/rad_supplements.csv`
- [x] Magnesium glycinate/citrate: A → B. A-grade for cramps/sleep
      generally, thin for lipedema specifically.
  → `tools/data/rad_supplements.csv`
- [x] Omega-3 fish oil: promoted optional → core. Retained A grade
      per scoping-review "Suggested" tier.
  → `tools/data/rad_supplements.csv`
- [x] Vitamin C: **new row added** at core / B. One of only two
      "Suggested" tier supplements per 2025 scoping review
      (alongside DHA/EPA).
  → `tools/data/rad_supplements.csv`

**New additions in `keto_supplements.csv`:**

- [x] Calcium monitoring row added. Addresses urinary-calcium-
      excretion / bone-density risk explicitly flagged by 2025
      scoping review for low-carb diets.
  → `tools/data/keto_supplements.csv`
- [x] Vitamin C row added.
  → `tools/data/keto_supplements.csv`

**Fact corrections in `keto.md`:**

- [x] Removed the miscited "RCT (Cannataro 2021, 70 women, 8 weeks)"
      line. Lundanes 2024 now cited as the n=70 RCT; Cannataro noted
      as single-case.
  → `tools/data/keto.md`
- [x] Evidence quality table re-graded: "Low-carb reduces lipedema
      pain independent of weight loss" promoted to **A** (Lundanes
      RCT); "Keto reduces lipedema pain + body composition" at **B**
      (Sørlie pilot + SR + Cannataro case).
  → `tools/data/keto.md`
- [x] New row: "Low-carb increases urinary calcium excretion /
      bone-loss risk" at **B**. Scoping-review flag.
  → `tools/data/keto.md`
- [x] New row: "No supplement has established efficacy for lipedema
      per se" at meta-evidence level.
  → `tools/data/keto.md`

**Fact corrections in `rad.md`:**

- [x] "Evidence quality" section rewritten against 2025 scoping
      review framework. "Moderate evidence" (keto/low-carb) noted as
      top of a thin field.
  → `tools/data/rad.md`
- [x] "No supplement has established efficacy" caveat added
      explicitly with scoping-review citation.
  → `tools/data/rad.md`
- [x] German DGPL S2k consensus added (94.7% keto, 100%
      Mediterranean).
  → `tools/data/rad.md`

**New `supplements.md` sections:**

- [x] Headline caveat quoting 2025 scoping review directly
  → `tools/data/supplements.md`
- [x] Suggested / Evaluate / Weak tier framework replacing
      A/B/C-only grading
  → `tools/data/supplements.md`
- [x] Vitamin C section at Suggested tier
  → `tools/data/supplements.md`
- [x] Contraindications + drug interactions table (K2/warfarin,
      diosmin/anticoagulants, berberine/metformin, Ca/thyroid binding,
      Se upper limit, Mg/bisphosphonate, Zn/Cu balance, high-dose
      vitC/chemo, high-dose D3/thiazides)
  → `tools/data/supplements.md`
- [x] Pregnancy + breastfeeding section
  → `tools/data/supplements.md`

**New file `tools/data/labs.md`:**

- [x] Baseline panel (25(OH)D, ferritin, B12, adjusted Ca, Mg,
      selenium, TSH/fT3/fT4, fasting insulin/glucose/HbA1c, lipids
      incl. ApoB, hsCRP, ALT/AST/creatinine/eGFR)
  → `tools/data/labs.md`
- [x] Symptom + anthropometric tracking (VAS pain, circumferences,
      QoL, BMI warning, bioimpedance unreliable, DXA as ground truth)
  → `tools/data/labs.md`
- [x] Follow-up cadence (w2, w6–8, m3, m6, m12 + DXA)
  → `tools/data/labs.md`
- [x] Keto-specific additions (vit E, manganese, urinary calcium
      when symptomatic)
  → `tools/data/labs.md`
- [x] Drug/supplement interactions + pregnancy guidance
  → `tools/data/labs.md`

## Dependencies

- [spec-data-layer.md](./spec-data-layer.md) — the grades this spec
  calibrates are stored in the CSVs defined there.
