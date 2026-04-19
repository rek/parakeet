import { Badge } from '../components/Badge';
import { TablePage } from '../components/TablePage';
import { useSupabaseRows } from '../lib/useSupabaseRows';
import { theme } from '../lib/theme';

interface PerfRow {
  id: string;
  recorded_at: string;
  user_id: string;
  session_log_id: string;
  lift: string;
  intensity_type: string;
  week_number: number | null;
  block_number: number | null;
  planned_volume_grams: number | null;
  actual_volume_grams: number | null;
  planned_intensity_pct: number | null;
  actual_intensity_pct: number | null;
  avg_rpe_actual: number | null;
  max_rpe_actual: number | null;
  estimated_1rm_grams: number | null;
  completion_pct: number | null;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kg(grams: number | null) {
  if (grams == null) return '—';
  return `${(grams / 1000).toFixed(1)}kg`;
}

function deltaBadge(planned: number | null, actual: number | null) {
  if (planned == null || actual == null || planned === 0) {
    return <Badge label="—" variant="muted" />;
  }
  const ratio = actual / planned;
  if (ratio >= 1.05) return <Badge label={`+${((ratio - 1) * 100).toFixed(0)}%`} variant="green" />;
  if (ratio <= 0.95)
    return <Badge label={`${((ratio - 1) * 100).toFixed(0)}%`} variant="red" />;
  return <Badge label="≈ Plan" variant="blue" />;
}

export function PerformanceMetrics() {
  const { rows, loading, error } = useSupabaseRows<PerfRow>((s) =>
    s
      .from('performance_metrics')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(80)
  );

  const totalSessions = rows.length;
  const overPlan = rows.filter(
    (r) =>
      r.planned_volume_grams != null &&
      r.actual_volume_grams != null &&
      r.actual_volume_grams > r.planned_volume_grams * 1.05
  ).length;
  const underPlan = rows.filter(
    (r) =>
      r.planned_volume_grams != null &&
      r.actual_volume_grams != null &&
      r.actual_volume_grams < r.planned_volume_grams * 0.95
  ).length;

  return (
    <TablePage
      title="Performance Metrics"
      accent={theme.color.blue}
      subtitle={`Last ${totalSessions} sessions`}
      stats={[
        { label: 'Over plan', value: overPlan, color: theme.color.green },
        { label: 'Under plan', value: underPlan, color: theme.color.red },
      ]}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No performance metrics recorded yet."
      columnsTemplate="120px 80px 60px 100px 100px 90px 80px 80px"
      columnLabels={[
        'Recorded',
        'Lift',
        'Week',
        'Vol (planned)',
        'Vol (actual)',
        'vs Plan',
        'Avg RPE',
        'Est 1RM',
      ]}
      keyOf={(r) => r.id}
      renderRow={(r) => (
        <>
          <span style={{ color: theme.color.textDim }}>{fmt(r.recorded_at)}</span>
          <span style={{ fontWeight: 600 }}>
            {r.lift.charAt(0).toUpperCase() + r.lift.slice(1)}
          </span>
          <span style={{ color: theme.color.textDim }}>
            {r.week_number != null ? `W${r.week_number}` : '—'}
          </span>
          <span style={{ color: theme.color.textDim }}>{kg(r.planned_volume_grams)}</span>
          <span>{kg(r.actual_volume_grams)}</span>
          {deltaBadge(r.planned_volume_grams, r.actual_volume_grams)}
          <span style={{ color: theme.color.textDim }}>
            {r.avg_rpe_actual != null ? r.avg_rpe_actual.toFixed(1) : '—'}
          </span>
          <span>{kg(r.estimated_1rm_grams)}</span>
        </>
      )}
    />
  );
}
