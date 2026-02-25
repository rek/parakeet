export type WilksSex = 'male' | 'female'

// 2020 Wilks formula coefficients (worldpowerlifting.com)
// Formula: score = totalKg × (600 / polynomial(bodyweightKg))
const COEFFICIENTS: Record<WilksSex, [number, number, number, number, number, number]> = {
  female: [
     594.31747775582,
    -27.23842536447,
      0.82112226871,
     -0.00930733913,
      0.00004731582,
     -0.00000009054,
  ],
  male: [
    -216.0475144,
      16.2606339,
      -0.002388645,
      -0.00113732,
       0.000007018630,
      -0.00000001291,
  ],
}

const BW_RANGE: Record<WilksSex, [number, number]> = {
  female: [40, 150],
  male:   [40, 200],
}

export function computeWilks2020(totalKg: number, bodyweightKg: number, sex: WilksSex): number {
  if (totalKg <= 0) return 0

  const [min, max] = BW_RANGE[sex]
  const bw = Math.min(Math.max(bodyweightKg, min), max)

  const [a, b, c, d, e, f] = COEFFICIENTS[sex]
  const poly = a + b * bw + c * bw ** 2 + d * bw ** 3 + e * bw ** 4 + f * bw ** 5

  const score = totalKg * (600 / poly)
  return Math.round(score * 100) / 100
}
