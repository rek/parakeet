/** Convert kilograms to integer grams for database storage. */
export function weightKgToGrams(kg: number) {
  return Math.round(kg * 1000);
}

/** Convert integer grams from database to kilograms. */
export function weightGramsToKg(grams: number) {
  return grams / 1000;
}

/** Round a weight to the nearest plate increment (default 2.5 kg). */
export function roundToNearest(weightKg: number, incrementKg = 2.5) {
  return Math.round(weightKg / incrementKg) * incrementKg;
}
