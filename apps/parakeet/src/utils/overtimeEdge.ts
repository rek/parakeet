/**
 * Returns true when rest transitions from active (remaining > 0) into overtime
 * (remaining <= 0) for the first time in a given rest interval.
 *
 * Call this on every timer tick. Pass `prevOvertime` from a ref that is updated
 * after each tick, and reset to `false` when a new timer starts or closes.
 */
export function detectOvertimeEdge(prevOvertime: boolean, remaining: number): boolean {
  return !prevOvertime && remaining <= 0
}
