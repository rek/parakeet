import { Badge } from '../components/Badge';
import { TablePage } from '../components/TablePage';
import { useSupabaseRows } from '../lib/useSupabaseRows';
import { theme } from '../lib/theme';

interface SetLogRow {
  id: string;
  logged_at: string;
  user_id: string;
  session_id: string;
  set_number: number;
  kind: string;
  exercise: string | null;
  exercise_type: string | null;
  weight_grams: number;
  reps_completed: number;
  rpe_actual: number | null;
  failed: boolean;
  actual_rest_seconds: number | null;
  corrected_by: string | null;
  notes: string | null;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kindBadge(kind: string) {
  if (kind === 'primary') return <Badge label="Primary" variant="accent" />;
  if (kind === 'auxiliary') return <Badge label="Aux" variant="blue" />;
  if (kind === 'warmup') return <Badge label="Warmup" variant="muted" />;
  return <Badge label={kind} variant="muted" />;
}

export function SetLogs() {
  const { rows, loading, error } = useSupabaseRows<SetLogRow>((s) =>
    s
      .from('set_logs')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(100)
  );

  const failed = rows.filter((r) => r.failed).length;
  const corrected = rows.filter((r) => r.corrected_by != null).length;
  const totalReps = rows.reduce((n, r) => n + r.reps_completed, 0);

  return (
    <TablePage
      title="Set Logs"
      accent={theme.color.green}
      subtitle={`Last ${rows.length} sets`}
      stats={[
        { label: 'Failed', value: failed, color: theme.color.red },
        { label: 'Corrected', value: corrected, color: theme.color.accent },
        { label: 'Reps logged', value: totalReps, color: theme.color.green },
      ]}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No set logs recorded yet. Set durability rolls out per-set after backlog #16."
      columnsTemplate="120px 80px 60px 1fr 90px 60px 60px 70px"
      columnLabels={[
        'Logged',
        'Kind',
        'Set',
        'Exercise',
        'Weight',
        'Reps',
        'RPE',
        'Status',
      ]}
      keyOf={(r) => r.id}
      renderRow={(r) => (
        <>
          <span style={{ color: theme.color.textDim }}>{fmt(r.logged_at)}</span>
          {kindBadge(r.kind)}
          <span style={{ color: theme.color.textDim }}>#{r.set_number}</span>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={r.exercise ?? ''}
          >
            {r.exercise ?? '—'}
            {r.exercise_type && (
              <span
                style={{ color: theme.color.textMuted, marginLeft: 4, fontSize: 10 }}
              >
                {r.exercise_type}
              </span>
            )}
          </span>
          <span>{(r.weight_grams / 1000).toFixed(1)}kg</span>
          <span>{r.reps_completed}</span>
          <span style={{ color: theme.color.textDim }}>
            {r.rpe_actual ?? '—'}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {r.failed && <Badge label="Failed" variant="red" />}
            {r.corrected_by != null && (
              <Badge label="Corr." variant="accent" />
            )}
          </div>
        </>
      )}
    />
  );
}
