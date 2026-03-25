/** 1-5 scale. Legacy 1-3 values are accepted and normalised:
 *  old 1 (poor) → 1, old 2 (normal) → 3, old 3 (great) → 5. */
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

/** Normalise legacy 1-3 input to 1-5 scale.
 *  1→1, 2→3, 3→5. Values 4-5 are already on the new scale. */
function normalise(level: number): number {
  if (level >= 4) return level;
  if (level === 1) return 1;
  if (level === 3) return 5;
  return 3; // level === 2 → neutral midpoint
}

/** Returns an intensity/volume modifier based on sleep quality and energy level.
 *  Both inputs are optional — undefined is treated as normal (neutral).
 *  Accepts both legacy 1-3 and new 1-5 inputs via normalisation. */
export function getReadinessModifier(
  sleepQuality?: ReadinessLevel,
  energyLevel?: ReadinessLevel
): ReadinessModifier {
  // Default undefined to old-scale 2 (normal) which normalises to 3 (neutral)
  const s = normalise(sleepQuality ?? 2);
  const e = normalise(energyLevel ?? 2);

  // Both poor (1-2 on 5-point scale)
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

  // Both great (4-5 on 5-point scale)
  if (s >= 4 && e >= 4) {
    return {
      setReduction: 0,
      intensityMultiplier: 1.025,
      rationale: 'Great sleep and high energy — intensity boosted 2.5%',
    };
  }

  return NEUTRAL;
}
