/**
 * Format a weight in kg for display — strips trailing .0 for whole numbers.
 *
 * 50 → "50", 52.5 → "52.5"
 */
export function fmtKg(kg: number) {
  return kg % 1 === 0 ? `${kg}` : kg.toFixed(1);
}
