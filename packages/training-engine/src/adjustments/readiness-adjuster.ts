/** Subjective readiness scale.
 *
 *  Native 1–5: 1 = worst (Drained/Terrible), 3 = neutral (OK), 5 = best (High/Great).
 *  This is the same scale rendered on the soreness screen pills and the same
 *  scale `applyVolumeCalibration` reads. The engine reads these values raw —
 *  there is no internal collapse to a legacy 1–3 scale.
 *
 *  Adjustment bands:
 *    1–2 = poor (intensity ↓ 2.5% per signal; both poor → 1 set off + 5% ↓)
 *    3   = neutral (no change)
 *    4–5 = great (boost 2.5% only when BOTH are 4+)
 *
 *  Undefined inputs are treated as neutral (3) — no signal means no change. */
export type ReadinessLevel = 1 | 2 | 3 | 4 | 5;

export interface ReadinessModifier {
  setReduction: number;
  intensityMultiplier: number;
  rationale: string | null;
}

const NEUTRAL: ReadinessModifier = {
  setReduction: 0,
  intensityMultiplier: 1.0,
  rationale: null,
};

/** Returns an intensity/volume modifier based on sleep quality and energy level.
 *  Both inputs are optional — undefined is treated as neutral. */
export function getReadinessModifier(
  sleepQuality?: ReadinessLevel,
  energyLevel?: ReadinessLevel
): ReadinessModifier {
  const s = sleepQuality ?? 3;
  const e = energyLevel ?? 3;

  // Both poor (1–2)
  if (s <= 2 && e <= 2) {
    return {
      setReduction: 1,
      intensityMultiplier: 0.95,
      rationale: 'Poor sleep and low energy — reduced volume and intensity 5%',
    };
  }

  // Poor sleep only
  if (s <= 2) {
    return {
      setReduction: 0,
      intensityMultiplier: 0.975,
      rationale: 'Poor sleep — reduced intensity 2.5%',
    };
  }

  // Low energy only
  if (e <= 2) {
    return {
      setReduction: 0,
      intensityMultiplier: 0.975,
      rationale: 'Low energy — reduced intensity 2.5%',
    };
  }

  // Both great (4–5)
  if (s >= 4 && e >= 4) {
    return {
      setReduction: 0,
      intensityMultiplier: 1.025,
      rationale: 'Great sleep and high energy — intensity boosted 2.5%',
    };
  }

  return NEUTRAL;
}
