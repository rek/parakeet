// @spec docs/features/history/spec-tab-upgrade.md
import { MIN_CHART_OPACITY } from './chart-helpers';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChartEntry {
  date: string;
  value: number;
}

interface ChartDataset {
  data: number[];
  color: (opacity?: number) => string;
  strokeWidth: number;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

// ── Functions ─────────────────────────────────────────────────────────────────

/**
 * Builds react-native-chart-kit compatible chart data from a list of
 * date/value entries. Returns null when there are no valid entries.
 *
 * @param chartEntries - Array of { date, value } pairs, oldest first.
 * @param liftColor    - Hex color string for the line (e.g. '#a3e635').
 */
export function buildLiftChartData(
  chartEntries: ChartEntry[],
  liftColor: string
): ChartData | null {
  if (chartEntries.length < 1) return null;

  const labelStep = Math.max(1, Math.ceil(chartEntries.length / 6));

  return {
    labels: chartEntries.map((e, i) => {
      if (i % labelStep !== 0) return '';
      const d = new Date(e.date);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }),
    datasets: [
      {
        data: chartEntries.map((e) => parseFloat(e.value.toFixed(1))),
        color: (opacity = 1) =>
          liftColor +
          Math.round(Math.max(opacity, MIN_CHART_OPACITY) * 255)
            .toString(16)
            .padStart(2, '0'),
        strokeWidth: 2,
      },
    ],
  };
}
