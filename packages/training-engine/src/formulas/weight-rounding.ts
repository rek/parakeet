export function roundToNearest(weightKg: number, incrementKg = 2.5): number {
  return Math.round(weightKg / incrementKg) * incrementKg
}

export function gramsToKg(grams: number): number {
  return grams / 1000
}

export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000)
}
