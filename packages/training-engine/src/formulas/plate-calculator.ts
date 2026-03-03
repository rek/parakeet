const PLATE_SIZES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

export type PlateResult = {
  platesPerSide: { kg: number; count: number }[]
  barKg: number
  totalKg: number
  remainder: number
}

export function calculatePlates(targetKg: number, barKg: number): PlateResult {
  const weightPerSide = (targetKg - barKg) / 2
  const platesPerSide: { kg: number; count: number }[] = []
  let remaining = weightPerSide

  for (const plate of PLATE_SIZES_KG) {
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
