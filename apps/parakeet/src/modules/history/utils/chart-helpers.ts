import type { Lift } from '@parakeet/shared-types';

// react-native-chart-kit passes opacity=0.2 to dataset color functions for
// line strokes, making lines nearly invisible. Clamp to this minimum.
export const MIN_CHART_OPACITY = 0.8;

export type WeeklyVolRow = {
  weekStart: string;
  lift: Lift;
  setsCompleted: number;
};

export type WeeklyVolKgRow = {
  weekStart: string;
  lift: Lift;
  volumeKg: number;
};

function buildWeekList(weeklyData: { weekStart: string }[]): string[] | null {
  let weeks = [...new Set(weeklyData.map((d) => d.weekStart))].sort();
  if (weeks.length < 1) return null;
  // react-native-chart-kit requires 2+ data points to draw a line
  if (weeks.length === 1) {
    const prev = new Date(weeks[0]);
    prev.setDate(prev.getDate() - 7);
    weeks = [prev.toISOString().slice(0, 10), weeks[0]];
  }
  return weeks;
}

function buildWeekLabels(weeks: string[]): string[] {
  const labelStep = Math.max(1, Math.ceil(weeks.length / 6));
  return weeks.map((w, i) => {
    if (i % labelStep !== 0) return '';
    const d = new Date(w);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  });
}

function makeColorFn(hex: string) {
  return (opacity = 1) =>
    hex +
    Math.round(Math.max(opacity, MIN_CHART_OPACITY) * 255)
      .toString(16)
      .padStart(2, '0');
}

export function buildVolumeChartData(
  weeklyData: WeeklyVolRow[],
  liftColors: Record<Lift, string>,
  liftFilter?: Lift
) {
  const weeks = buildWeekList(weeklyData);
  if (!weeks) return null;

  const labels = buildWeekLabels(weeks);
  const lifts = liftFilter
    ? [liftFilter]
    : (['squat', 'bench', 'deadlift'] as Lift[]);

  const datasets = lifts.map((lift) => ({
    data: weeks.map((week) => {
      const entry = weeklyData.find(
        (d) => d.weekStart === week && d.lift === lift
      );
      return entry?.setsCompleted ?? 0;
    }),
    color: makeColorFn(liftColors[lift]),
    strokeWidth: 2,
  }));

  return { labels, datasets, lifts };
}

export function buildVolumeKgChartData(
  weeklyData: WeeklyVolKgRow[],
  liftColors: Record<Lift, string>,
  liftFilter?: Lift
) {
  const weeks = buildWeekList(weeklyData);
  if (!weeks) return null;

  const labels = buildWeekLabels(weeks);
  const lifts = liftFilter
    ? [liftFilter]
    : (['squat', 'bench', 'deadlift'] as Lift[]);

  const datasets = lifts.map((lift) => ({
    data: weeks.map((week) => {
      const entry = weeklyData.find(
        (d) => d.weekStart === week && d.lift === lift
      );
      return Math.round(entry?.volumeKg ?? 0);
    }),
    color: makeColorFn(liftColors[lift]),
    strokeWidth: 2,
  }));

  return { labels, datasets, lifts };
}
