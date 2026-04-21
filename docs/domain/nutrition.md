# Nutrition — macro targets

Source of truth for the macro-target calculator in the nutrition
module. Every constant below lives in
[`apps/parakeet/src/modules/nutrition/lib/macro-targets.ts`](../../apps/parakeet/src/modules/nutrition/lib/macro-targets.ts)
(`computeMacroTargets`) — update *this* doc when the code changes, not
the other way around.

Protocol-level context (why keto, why RAD, evidence grading) lives in
the feature docs:
[`docs/features/nutrition/`](../features/nutrition/).

## BMR cascade

One formula is used, in priority order:

| Formula | When | Source |
| --- | --- | --- |
| **Katch-McArdle** | `lean_mass_kg` is known. Most accurate for athletes and for lipedema (pathological adipose ≠ metabolically active tissue). | `BMR = 370 + 21.6 × lean_mass_kg` — Katch & McArdle, *Exercise Physiology*, 1996. |
| **Mifflin-St Jeor** | `height_cm` known, lean mass not. Clinical default. | `M: BMR = 10×kg + 6.25×cm − 5×age + 5`; `F: … − 161`. Mifflin et al., *Am J Clin Nutr* 1990. |
| **Bodyweight-only fallback** | Neither lean mass nor height known. Flags `low_confidence=true` so the UI shows a "rough estimate" badge. | `M: 24 × kg`; `F: 22 × kg`. Rule-of-thumb only. |

Lipedema caveat: bioimpedance-derived "lean mass" from a smart scale is
**unreliable on affected limbs**. DEXA is the ground truth. Documented
in `tools/data/labs.md` and surfaced on the profile edit UI.

## Activity multipliers (TDEE)

Standard Harris-Benedict style. Self-reported.

| Level | Multiplier | Description |
| --- | --- | --- |
| `sedentary` | 1.2 | Desk job, no training |
| `light` | 1.375 | 1–2 easy sessions/week |
| `moderate` | 1.55 | 3–4 sessions/week |
| `active` | 1.725 | **Powerlifter default** — 5–6 heavy compound sessions/week |
| `very_active` | 1.9 | 6+ heavy sessions/week or active job on top |

**Powerlifter calibration note.** Harris-Benedict / Mifflin-St Jeor
multipliers were derived for the general population and tend to
*undercount* NEAT on heavy compound training days (thermic cost of
~5 × 5 @ RPE 8+ isn't equivalent to the same volume of cardio in
these tables). The parakeet default for a training lifter is
`active`, not `moderate`. Drop to `moderate` for deload weeks or
when volume is genuinely low. If the lifter is under-recovering
with session RPE trending up week-over-week, bumping to
`very_active` is often the corrective lever.

## Goal adjustments

Applied to TDEE after multiplier.

| Goal | Delta | Rationale |
| --- | --- | --- |
| `cut` | −15% | Moderate deficit — protects lean mass better than aggressive cuts, more sustainable. |
| `maintain` | 0% | **Default** |
| `bulk` | +10% | Lean-gain surplus; larger surpluses waste into adipose. |

## Protein targets

Lean-mass basis preferred when known (protein scales with metabolically
active tissue, not total body weight).

| Protocol | g/kg (basis) | Source |
| --- | --- | --- |
| Keto | 1.4 g/kg (lean if known else bodyweight) | Cannataro 2021 protocol (~30% kcal from protein in an 1300 kcal plan). |
| RAD | 1.8 g/kg | Helms et al., *Int Soc Sports Nutr* position stand on natural bodybuilding; slightly above-floor for strength athletes. |
| Standard | 1.8 g/kg (lean if known else bodyweight) | Same floor as RAD — strength training demands apply regardless of dietary approach. ISSN position stand on protein and exercise (Stokes et al. 2018). |

**Training-day bump**: `protein_g × 1.1` on training days, per the ISSN
position stand on protein timing & training demands.

## Protocol splits

After BMR × activity × goal gives daily kcal, and protein is locked by
g/kg:

### Keto

- **Carbohydrate ceiling**: 50 g total / 20 g net per day — hard cap,
  not % of kcal. The ceiling (rather than ratio) is what defines
  ketosis. Cannataro 2021, Sørlie LIPODIET 2022.
- **Fat**: residual — `fat_g = (kcal − protein_kcal − carb_kcal) / 9`.
- **Fat clamp**: `max(0, …)` to guard against bulk + small lifter
  combos where protein + carb kcal exceed target.

### RAD

- **Fat**: 40% of kcal — Mediterranean-style, emphasises olive oil /
  fatty fish / nuts.
- **Protein**: g/kg basis (as above); becomes residual % by implication.
- **Carbohydrate**: `(kcal − protein_kcal − fat_kcal) / 4` — residual.
  Net carbs are not tracked here (RAD emphasises glycemic index /
  whole-food quality rather than a hard cap).

### Standard

Carb-forward approach suited to amateur powerlifters who eat a
conventional diet without specialised protocols. Lower dietary
friction than RAD or Keto — macros map naturally to how most people
already eat (rice, potatoes, oats, meat, eggs).

- **Carbohydrate**: 45% of kcal — first allocation. Supports
  glycolytic demand of heavy compound training; within the AMDR
  (45–65%) for active individuals.
- **Fat**: residual — `fat_g = (kcal − protein_kcal − carb_kcal) / 9`.
  Typically lands ~25–30% depending on bodyweight and goal.
- **Protein**: 1.8 g/kg (same floor as RAD). Strength training
  demands do not change because the dietary approach is different.

## Output shape

`computeMacroTargets` returns a `MacroTarget`:

```ts
interface MacroTarget {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  net_carb_g_cap: number | null;   // 20 on keto, null on RAD
  bmr_kcal: number;
  tdee_kcal: number;
  bmr_method: 'katch_mcardle' | 'mifflin_st_jeor' | 'fallback';
  low_confidence: boolean;          // true when fallback used or age missing
}
```

`low_confidence` is the UI hook — surfaced as a "rough estimate" badge
on `MacroTargetsCard` and drives the prompt to complete profile fields.

## References

- Mifflin et al. *A new predictive equation for resting energy
  expenditure in healthy individuals.* Am J Clin Nutr 1990.
- Katch VL, McArdle WD. *Exercise Physiology.* 1996.
- Cannataro 2021 — keto protocol example (RCT case): omega-3 3 g,
  vitamin C 1 g, vitamin D 2000 IU (see `tools/data/keto.md`).
- Sørlie LIPODIET 2022 pilot — 70–75% fat / 5–10% carb / 20% protein
  on 9 women (see `tools/data/keto.md`).
- Helms et al. *Evidence-based recommendations for natural bodybuilding
  contest preparation.* Int Soc Sports Nutr, 2014. Protein g/kg.
- Full evidence scoping: `tools/data/keto.md`, `tools/data/rad.md`,
  and the 2025 Nutrition Reviews scoping review (cited there).
