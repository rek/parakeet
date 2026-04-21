/**
 * Pure conversion helpers for circumference storage (mm on the wire,
 * cm in the UI). Integers at the DB boundary, decimals for human
 * entry. Matches parakeet's lift-weight convention (grams↔kg).
 */

/** cm string → integer mm. Empty / invalid → null. 1 decimal accepted. */
export function cmStringToMm(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10);
}

/** integer mm → cm string with 1 decimal. null/undefined → empty. */
export function mmToCmString(mm: number | null | undefined): string {
  if (mm == null) return '';
  return (mm / 10).toFixed(1);
}

/** Numeric 0-10 string → number. Clamp + reject NaN. */
export function parseZeroToTen(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 10) return 10;
  return n;
}
