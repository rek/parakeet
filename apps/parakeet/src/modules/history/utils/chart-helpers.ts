import type { Lift } from '@parakeet/shared-types'

export type WeeklyVolRow = { weekStart: string; lift: Lift; setsCompleted: number }

export function buildVolumeChartData(
  weeklyData: WeeklyVolRow[],
  liftColors: Record<Lift, string>,
) {
  let weeks = [...new Set(weeklyData.map((d) => d.weekStart))].sort()
  if (weeks.length < 1) return null

  // react-native-chart-kit requires 2+ data points to draw a line
  if (weeks.length === 1) {
    const prev = new Date(weeks[0])
    prev.setDate(prev.getDate() - 7)
    weeks = [prev.toISOString().slice(0, 10), weeks[0]]
  }

  const labels = weeks.map((w) => {
    const d = new Date(w)
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  })

  const datasets = (['squat', 'bench', 'deadlift'] as Lift[]).map((lift) => {
    const hex = liftColors[lift]
    return {
      data: weeks.map((week) => {
        const entry = weeklyData.find(
          (d) => d.weekStart === week && d.lift === lift,
        )
        return entry?.setsCompleted ?? 0
      }),
      color: (opacity = 1) =>
        hex +
        Math.round(opacity * 255)
          .toString(16)
          .padStart(2, '0'),
      strokeWidth: 2,
    }
  })

  return { labels, datasets }
}
