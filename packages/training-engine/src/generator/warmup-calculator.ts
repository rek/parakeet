import { roundToNearest } from '../formulas/weight-rounding'

export type WarmupPresetName = 'standard' | 'standard_female' | 'minimal' | 'extended' | 'empty_bar'

export type WarmupProtocol =
  | { type: 'preset'; name: WarmupPresetName }
  | { type: 'custom'; steps: WarmupStep[] }

export interface WarmupStep {
  pct: number  // fraction of working weight; 0 = fixed 20kg (bar)
  reps: number
}

export interface WarmupSet {
  setNumber: number
  weightKg: number
  displayWeight: string
  reps: number
  isWarmup: true
}

const PRESET_STEPS: Record<WarmupPresetName, WarmupStep[]> = {
  standard: [
    { pct: 0.40, reps: 5 },
    { pct: 0.60, reps: 3 },
    { pct: 0.75, reps: 2 },
    { pct: 0.90, reps: 1 },
  ],
  standard_female: [
    { pct: 0.40, reps: 5 },
    { pct: 0.55, reps: 4 },
    { pct: 0.70, reps: 3 },
    { pct: 0.85, reps: 2 },
    { pct: 0.925, reps: 1 },
  ],
  minimal: [
    { pct: 0.50, reps: 5 },
    { pct: 0.75, reps: 2 },
  ],
  extended: [
    { pct: 0.30, reps: 10 },
    { pct: 0.50, reps: 5 },
    { pct: 0.65, reps: 3 },
    { pct: 0.80, reps: 2 },
    { pct: 0.90, reps: 1 },
    { pct: 0.95, reps: 1 },
  ],
  // pct: 0 → always resolves to 20kg (bar) via Math.max(20, ...)
  empty_bar: [
    { pct: 0.00, reps: 10 },
    { pct: 0.50, reps: 5  },
    { pct: 0.70, reps: 3  },
    { pct: 0.85, reps: 1  },
  ],
}

export function getPresetSteps(name: WarmupPresetName): WarmupStep[] {
  return PRESET_STEPS[name]
}

export function resolveProtocol(protocol: WarmupProtocol): WarmupStep[] {
  if (protocol.type === 'custom') return protocol.steps
  return getPresetSteps(protocol.name)
}

export function generateWarmupSets(
  workingWeightKg: number,
  protocol: WarmupProtocol,
): WarmupSet[] {
  const steps = resolveProtocol(protocol)
  const sets: WarmupSet[] = []
  let prevWeight: number | null = null

  for (const step of steps) {
    const weightKg = Math.max(20, roundToNearest(workingWeightKg * step.pct))

    // Skip duplicate consecutive weights
    if (prevWeight !== null && weightKg === prevWeight) continue

    const displayWeight = weightKg === 20 ? '20 kg (bar)' : `${weightKg} kg`

    sets.push({
      setNumber: sets.length + 1,
      weightKg,
      displayWeight,
      reps: step.reps,
      isWarmup: true,
    })

    prevWeight = weightKg
  }

  return sets
}
