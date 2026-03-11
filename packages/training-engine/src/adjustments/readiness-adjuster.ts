export type ReadinessLevel = 1 | 2 | 3;

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
 *  Both inputs are optional — undefined is treated as normal (2). */
export function getReadinessModifier(
  sleepQuality?: ReadinessLevel,
  energyLevel?: ReadinessLevel
): ReadinessModifier {
  const s = sleepQuality ?? 2;
  const e = energyLevel ?? 2;

  // Both poor
  if (s === 1 && e === 1) {
    return {
      setReduction: 1,
      intensityMultiplier: 0.95,
      rationale: 'Poor sleep and low energy — reduced volume and intensity 5%',
    };
  }

  // Poor sleep only
  if (s === 1 && e !== 1) {
    return {
      setReduction: 0,
      intensityMultiplier: 0.975,
      rationale: 'Poor sleep — reduced intensity 2.5%',
    };
  }

  // Low energy only
  if (s !== 1 && e === 1) {
    return {
      setReduction: 0,
      intensityMultiplier: 0.975,
      rationale: 'Low energy — reduced intensity 2.5%',
    };
  }

  // Both great
  if (s === 3 && e === 3) {
    return {
      setReduction: 0,
      intensityMultiplier: 1.025,
      rationale: 'Great sleep and high energy — intensity boosted 2.5%',
    };
  }

  return NEUTRAL;
}
