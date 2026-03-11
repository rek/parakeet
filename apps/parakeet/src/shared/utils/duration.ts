export function formatMMSS(totalSeconds: number): string {
  const absSeconds = Math.abs(Math.floor(totalSeconds));
  const m = Math.floor(absSeconds / 60);
  const s = absSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
