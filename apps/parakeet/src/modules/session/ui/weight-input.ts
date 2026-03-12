/** Parse weight text input to kg. Returns 0 for empty/dot-only/invalid strings. */
export function parseWeightInput(text: string): number {
  const parsed = parseFloat(text);
  if (!isNaN(parsed) && parsed >= 0) return parsed;
  return 0;
}
