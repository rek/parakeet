import { Badge } from '../components/Badge';
import { TablePage } from '../components/TablePage';
import { useSupabaseRows } from '../lib/useSupabaseRows';
import { theme } from '../lib/theme';

interface ReviewRow {
  id: string;
  created_at: string;
  user_id: string;
  program_id: string | null;
  week_number: number;
  predicted_fatigue: Record<string, unknown> | null;
  felt_soreness: Record<string, unknown> | null;
  mismatches: Record<string, unknown> | null;
  notes: string | null;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function muscleCount(v: unknown): number {
  if (v == null || typeof v !== 'object') return 0;
  return Object.keys(v as Record<string, unknown>).length;
}

function mismatchSummary(m: unknown): string {
  if (m == null || typeof m !== 'object') return '—';
  const obj = m as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return 'None';
  return keys.slice(0, 3).join(', ') + (keys.length > 3 ? '…' : '');
}

export function WeeklyBodyReviews() {
  const { rows, loading, error } = useSupabaseRows<ReviewRow>((s) =>
    s
      .from('weekly_body_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60)
  );

  const withMismatches = rows.filter(
    (r) => r.mismatches && Object.keys(r.mismatches).length > 0
  ).length;
  const withNotes = rows.filter((r) => r.notes != null && r.notes.length > 0)
    .length;

  return (
    <TablePage
      title="Weekly Body Reviews"
      accent={theme.color.purple}
      subtitle={`Last ${rows.length} reviews`}
      stats={[
        {
          label: 'With mismatches',
          value: withMismatches,
          color: theme.color.red,
        },
        { label: 'With notes', value: withNotes, color: theme.color.accent },
      ]}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No weekly body reviews yet."
      columnsTemplate="110px 1fr 60px 90px 90px 1fr"
      columnLabels={[
        'Submitted',
        'User',
        'Week',
        'Predicted',
        'Felt',
        'Mismatches',
      ]}
      keyOf={(r) => r.id}
      renderRow={(r) => (
        <>
          <span style={{ color: theme.color.textDim }}>{fmt(r.created_at)}</span>
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
          <span>W{r.week_number}</span>
          <Badge
            label={`${muscleCount(r.predicted_fatigue)} mus`}
            variant="blue"
          />
          <Badge
            label={`${muscleCount(r.felt_soreness)} mus`}
            variant="accent"
          />
          <span
            style={{
              color: theme.color.textDim,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {mismatchSummary(r.mismatches)}
          </span>
        </>
      )}
    />
  );
}
