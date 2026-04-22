// @spec docs/features/programs/spec-generation-api.md
/**
 * Compute the smallest shift (in days) to move from one first-training-day
 * weekday to another, using the closest rotation direction.
 *
 * e.g. Tue(2)→Mon(1) = -1, not +6.
 */
export function computeMinimalDayShift({
  oldFirst,
  newFirst,
}: {
  oldFirst: number;
  newFirst: number;
}) {
  let shift = newFirst - oldFirst;
  if (shift > 3) shift -= 7;
  if (shift < -3) shift += 7;
  return shift;
}
