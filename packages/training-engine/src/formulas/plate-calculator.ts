const PLATE_SIZES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const
export type PlateKg = (typeof PLATE_SIZES_KG)[number]

/** Standard IWF plate colors by weight (kg). */
export const PLATE_COLORS: Record<PlateKg, string> = {
  25: '#DC2626',
  20: '#1D4ED8',
  15: '#FACC15',
  10: '#15803D',
  5:  '#27272A',
  2.5: '#F87171',
  1.25: '#A1A1AA',
}

export type PlateResult = {
  platesPerSide: { kg: PlateKg; count: number }[]
  barKg: number
  totalKg: number
  remainder: number
}

export function calculatePlates(
  targetKg: number,
  barKg: number,
  availablePlates?: PlateKg[],
): PlateResult {
  const sizes = availablePlates
    ? PLATE_SIZES_KG.filter((p) => availablePlates.includes(p))
    : PLATE_SIZES_KG
  const weightPerSide = (targetKg - barKg) / 2
  const platesPerSide: { kg: PlateKg; count: number }[] = []
  let remaining = weightPerSide

  for (const plate of sizes) {
    if (remaining <= 0) break
    const count = Math.floor(remaining / plate)
    if (count > 0) {
      platesPerSide.push({ kg: plate, count })
      remaining -= plate * count
    }
  }

  const remainder = Math.round(remaining * 100) / 100

  return {
    platesPerSide,
    barKg,
    totalKg: targetKg,
    remainder,
  }
}
