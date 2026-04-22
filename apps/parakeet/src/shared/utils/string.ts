export function capitalize(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatExerciseName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Build the header label for a session (e.g. "Squat — Heavy" or "Ad-Hoc Workout"). */
export function sessionLabel(meta: {
  primary_lift?: string | null;
  intensity_type?: string | null;
  activity_name?: string | null;
}): string {
  if (meta.primary_lift) {
    const lift = capitalize(meta.primary_lift);
    const intensity = meta.intensity_type
      ? capitalize(meta.intensity_type)
      : '';
    return intensity ? `${lift} — ${intensity}` : lift;
  }
  return meta.activity_name ?? 'Ad-Hoc Workout';
}
