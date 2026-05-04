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

/**
 * cm string → integer mm, but only when the string represents a
 * realistic limb measurement *in progress*. Used by the live delta
 * tag in the entry form: while the user is mid-typing ("0", "0.",
 * ".") we do not want to compare to the prior value and flash a
 * misleading huge negative delta. Returns null until the input parses
 * to a value of at least 1 cm.
 */
export function parseInProgressCmToMm(s: string): number | null {
  const mm = cmStringToMm(s);
  if (mm == null) return null;
  if (mm < 10) return null;
  return mm;
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
