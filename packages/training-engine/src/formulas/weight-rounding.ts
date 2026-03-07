export function roundToNearest(weightKg: number, incrementKg = 2.5): number {
  return Math.round(weightKg / incrementKg) * incrementKg
}

export function gramsToKg(grams: number): number {
  return grams / 1000
}

export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000)
}

export function estimateWorkingWeight(oneRmKg: number, workingPct = 0.8): number {
  return Math.round(oneRmKg * workingPct * 2) / 2
}
