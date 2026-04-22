import { INTENSITY_LABELS, LIFT_LABELS } from '@shared/constants';

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  planned: 1,
  completed: 2,
  skipped: 3,
  missed: 4,
};

function isFreeFormAdHoc(s: {
  program_id?: string | null;
  primary_lift?: string | null;
}): boolean {
  return s.program_id === null && !s.primary_lift;
}

export function formatSessionDisplay(session: {
  primary_lift?: string | null;
  activity_name?: string | null;
  intensity_type?: string | null;
}): { liftName: string; intensityName: string | null } {
  const adHoc = !session.primary_lift;
  if (adHoc) {
    return {
      liftName: session.activity_name ?? 'Ad-Hoc Workout',
      intensityName: null,
    };
  }
  return {
    liftName:
      LIFT_LABELS[session.primary_lift as keyof typeof LIFT_LABELS] ??
      session.primary_lift ??
      '',
    intensityName: session.intensity_type
      ? (INTENSITY_LABELS[session.intensity_type] ?? session.intensity_type)
      : null,
  };
}

export function partitionTodaySessions<
  T extends {
    status: string;
    program_id?: string | null;
    primary_lift?: string | null;
  },
>(sessions: T[]): { completed: T[]; upcoming: T[] } {
  const sorted = [...sessions].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5)
  );
  return {
    // Exclude completed ad-hoc — they don't need a "done" card
    completed: sorted.filter((s) => s.status === 'completed' && !isFreeFormAdHoc(s)),
    // Exclude completed, skipped, and missed — these are done
    upcoming: sorted.filter(
      (s) =>
        s.status !== 'completed' &&
        s.status !== 'skipped' &&
        s.status !== 'missed'
    ),
  };
}
