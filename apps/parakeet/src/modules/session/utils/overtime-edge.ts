export function detectOvertimeEdge(prevOvertime: boolean, remaining: number): boolean {
  return !prevOvertime && remaining <= 0
}
