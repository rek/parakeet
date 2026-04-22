// @spec docs/features/session/spec-auto-finalize.md
export function detectOvertimeEdge(
  prevOvertime: boolean,
  remaining: number
): boolean {
  return !prevOvertime && remaining <= 0;
}
