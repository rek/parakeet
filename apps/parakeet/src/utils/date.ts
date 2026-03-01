const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatDate(input: string | Date | null | undefined): string {
  if (input == null) return '—';
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '—';
    // UTC getters: YYYY-MM-DD strings parse as UTC midnight
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch {
    return '—';
  }
}
