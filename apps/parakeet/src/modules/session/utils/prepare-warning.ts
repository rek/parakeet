// @spec docs/features/session/spec-lifecycle.md
/**
 * Returns true when the 15-second prepare warning should fire.
 * Fires once per timer session when remaining crosses into ≤15s,
 * before the timer hits 0 (i.e. not in overtime), and only if
 * the warning hasn't already been fired this session.
 */
export function shouldFirePrepareWarning(
  remaining: number,
  overtime: boolean,
  warnFired: boolean
): boolean {
  return remaining <= 15 && remaining > 0 && !overtime && !warnFired;
}
