import { Badge } from '../components/Badge';
import { TablePage } from '../components/TablePage';
import { useSupabaseRows } from '../lib/useSupabaseRows';
import { theme } from '../lib/theme';

interface CycleStateRow {
  id: string;
  user_id: string;
  cycle_length_days: number;
  is_enabled: boolean;
  last_period_start: string | null;
  updated_at: string;
}

interface PeriodStartRow {
  id: string;
  user_id: string;
  start_date: string;
  created_at: string;
}

function fmtDate(d: string | null) {
  if (d == null) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysBetween(from: string, to = new Date()) {
  const ms = to.getTime() - new Date(from).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function CycleStateTable() {
  const { rows, loading, error } = useSupabaseRows<CycleStateRow>((s) =>
    s
      .from('cycle_tracking')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50)
  );

  const enabled = rows.filter((r) => r.is_enabled).length;

  return (
    <TablePage
      title="Cycle Tracking — Current State"
      accent={theme.color.purple}
      subtitle={`${rows.length} users`}
      stats={[
        { label: 'Enabled', value: enabled, color: theme.color.green },
      ]}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No users have cycle tracking configured."
      columnsTemplate="1fr 80px 80px 130px 130px"
      columnLabels={[
        'User',
        'Enabled',
        'Cycle days',
        'Last start',
        'Days since',
      ]}
      keyOf={(r) => r.id}
      renderRow={(r) => {
        const since = r.last_period_start
          ? daysBetween(r.last_period_start)
          : null;
        return (
          <>
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
            {r.is_enabled ? (
              <Badge label="On" variant="green" />
            ) : (
              <Badge label="Off" variant="muted" />
            )}
            <span>{r.cycle_length_days}d</span>
            <span style={{ color: theme.color.textDim }}>
              {fmtDate(r.last_period_start)}
            </span>
            <span
              style={{
                color:
                  since == null
                    ? theme.color.textMuted
                    : since > r.cycle_length_days
                      ? theme.color.accent
                      : theme.color.textDim,
              }}
            >
              {since != null ? `${since}d` : '—'}
            </span>
          </>
        );
      }}
    />
  );
}

function PeriodStartsTable() {
  const { rows, loading, error } = useSupabaseRows<PeriodStartRow>((s) =>
    s
      .from('period_starts')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(80)
  );

  return (
    <TablePage
      title="Period Starts — History"
      accent={theme.color.purple}
      subtitle={`Last ${rows.length} entries`}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No period start entries recorded."
      columnsTemplate="130px 1fr 130px"
      columnLabels={['Start date', 'User', 'Logged at']}
      keyOf={(r) => r.id}
      renderRow={(r) => (
        <>
          <span style={{ fontWeight: 600 }}>{fmtDate(r.start_date)}</span>
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
          <span style={{ color: theme.color.textMuted, fontSize: 10 }}>
            {fmtDate(r.created_at)}
          </span>
        </>
      )}
    />
  );
}

export function CycleTracking() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <CycleStateTable />
      <PeriodStartsTable />
    </div>
  );
}
