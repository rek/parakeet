export function birthYearToDobIso(birthYear: string): string {
  return `${parseInt(birthYear, 10)}-01-01`;
}

export function formatBirthYear(
  dateOfBirth: string | null | undefined
): string {
  return dateOfBirth ? new Date(dateOfBirth).getFullYear().toString() : '—';
}

export function formatBodyweight(kg: number | null | undefined): string {
  return kg != null ? `${kg} kg` : '—';
}
