import { Badge } from '../components/Badge';
import { TablePage } from '../components/TablePage';
import { useSupabaseRows } from '../lib/useSupabaseRows';
import { theme } from '../lib/theme';

interface DisruptionRow {
  id: string;
  reported_at: string;
  resolved_at: string | null;
  user_id: string;
  program_id: string | null;
  disruption_type: string;
  severity: string;
  status: string;
  description: string | null;
  affected_date_start: string;
  affected_date_end: string | null;
  affected_lifts: string[] | null;
  session_ids_affected: string[] | null;
  adjustment_applied: unknown;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDate(d: string | null) {
  if (d == null) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

function severityBadge(s: string) {
  if (s === 'severe' || s === 'high') return <Badge label="Severe" variant="red" />;
  if (s === 'moderate' || s === 'medium')
    return <Badge label="Moderate" variant="accent" />;
  if (s === 'mild' || s === 'low') return <Badge label="Mild" variant="blue" />;
  return <Badge label={s} variant="muted" />;
}

function statusBadge(s: string) {
  if (s === 'resolved') return <Badge label="Resolved" variant="green" />;
  if (s === 'active' || s === 'open')
    return <Badge label="Active" variant="red" />;
  if (s === 'monitoring') return <Badge label="Monitor" variant="accent" />;
  return <Badge label={s} variant="muted" />;
}

function typeBadge(t: string) {
  if (t === 'injury') return <Badge label="Injury" variant="red" />;
  if (t === 'illness') return <Badge label="Illness" variant="accent" />;
  if (t === 'travel') return <Badge label="Travel" variant="blue" />;
  if (t === 'life') return <Badge label="Life" variant="purple" />;
  return <Badge label={t} variant="muted" />;
}

export function Disruptions() {
  const { rows, loading, error } = useSupabaseRows<DisruptionRow>((s) =>
    s
      .from('disruptions')
      .select('*')
      .order('reported_at', { ascending: false })
      .limit(80)
  );

  const active = rows.filter(
    (r) => r.status === 'active' || r.status === 'open'
  ).length;
  const resolved = rows.filter((r) => r.status === 'resolved').length;
  const severe = rows.filter(
    (r) => r.severity === 'severe' || r.severity === 'high'
  ).length;

  return (
    <TablePage
      title="Disruptions"
      accent={theme.color.red}
      subtitle={`Last ${rows.length} reports`}
      stats={[
        { label: 'Active', value: active, color: theme.color.red },
        { label: 'Resolved', value: resolved, color: theme.color.green },
        { label: 'Severe', value: severe, color: theme.color.red },
      ]}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No disruptions reported."
      columnsTemplate="120px 90px 90px 90px 130px 80px 1fr"
      columnLabels={[
        'Reported',
        'Type',
        'Severity',
        'Status',
        'Affected dates',
        'Sessions',
        'Lifts',
      ]}
      keyOf={(r) => r.id}
      renderRow={(r) => (
        <>
          <span style={{ color: theme.color.textDim }}>{fmt(r.reported_at)}</span>
          {typeBadge(r.disruption_type)}
          {severityBadge(r.severity)}
          {statusBadge(r.status)}
          <span style={{ color: theme.color.textDim }}>
            {fmtDate(r.affected_date_start)} → {fmtDate(r.affected_date_end)}
          </span>
          <span style={{ color: theme.color.textDim }}>
            {r.session_ids_affected?.length ?? 0}
          </span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(r.affected_lifts ?? []).slice(0, 3).map((lift) => (
              <Badge key={lift} label={lift} variant="muted" />
            ))}
            {r.affected_lifts == null || r.affected_lifts.length === 0 ? (
              <span style={{ color: theme.color.textMuted, fontSize: 11 }}>
                —
              </span>
            ) : null}
          </div>
        </>
      )}
    />
  );
}
