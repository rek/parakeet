import { Badge } from '../components/Badge';
import { TablePage } from '../components/TablePage';
import { useSupabaseRows } from '../lib/useSupabaseRows';
import { theme } from '../lib/theme';

interface RecoveryRow {
  id: string;
  recorded_at: string;
  user_id: string;
  source: string;
  sleep_duration_minutes: number | null;
  sleep_quality_score: number | null;
  hrv_ms: number | null;
  resting_hr_bpm: number | null;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sleepLabel(min: number | null) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function sourceBadge(source: string) {
  if (source === 'manual') return <Badge label="Manual" variant="muted" />;
  if (source === 'whoop') return <Badge label="Whoop" variant="green" />;
  if (source === 'oura') return <Badge label="Oura" variant="blue" />;
  if (source === 'apple_health')
    return <Badge label="Apple" variant="accent" />;
  return <Badge label={source} variant="muted" />;
}

export function RecoverySnapshots() {
  const { rows, loading, error } = useSupabaseRows<RecoveryRow>((s) =>
    s
      .from('recovery_snapshots')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(80)
  );

  const withHrv = rows.filter((r) => r.hrv_ms != null).length;
  const withSleep = rows.filter((r) => r.sleep_duration_minutes != null).length;
  const sources = new Set(rows.map((r) => r.source)).size;

  return (
    <TablePage
      title="Recovery Snapshots"
      accent={theme.color.blue}
      subtitle={`Last ${rows.length} entries`}
      stats={[
        { label: 'With HRV', value: withHrv, color: theme.color.green },
        { label: 'With sleep', value: withSleep, color: theme.color.blue },
        { label: 'Sources', value: sources, color: theme.color.purple },
      ]}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No recovery snapshots recorded yet."
      columnsTemplate="120px 1fr 90px 80px 80px 80px 80px"
      columnLabels={[
        'Recorded',
        'User',
        'Source',
        'Sleep',
        'Quality',
        'HRV',
        'Rest HR',
      ]}
      keyOf={(r) => r.id}
      renderRow={(r) => (
        <>
          <span style={{ color: theme.color.textDim }}>{fmt(r.recorded_at)}</span>
          <span
            style={{
              color: theme.color.textDim,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={r.user_id}
          >
            {r.user_id.slice(0, 8)}
          </span>
          {sourceBadge(r.source)}
          <span>{sleepLabel(r.sleep_duration_minutes)}</span>
          <span style={{ color: theme.color.textDim }}>
            {r.sleep_quality_score != null
              ? r.sleep_quality_score.toFixed(0)
              : '—'}
          </span>
          <span>{r.hrv_ms != null ? `${r.hrv_ms.toFixed(0)}ms` : '—'}</span>
          <span>
            {r.resting_hr_bpm != null
              ? `${r.resting_hr_bpm.toFixed(0)}bpm`
              : '—'}
          </span>
        </>
      )}
    />
  );
}
