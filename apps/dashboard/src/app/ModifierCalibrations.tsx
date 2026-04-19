import { Badge } from '../components/Badge';
import { TablePage } from '../components/TablePage';
import { useSupabaseRows } from '../lib/useSupabaseRows';
import { theme } from '../lib/theme';

interface CalibrationRow {
  id: string;
  user_id: string;
  modifier_source: string;
  adjustment: number;
  confidence: string;
  sample_count: number;
  mean_bias: number | null;
  calibrated_at: string | null;
  updated_at: string | null;
}

function confidenceBadge(c: string) {
  if (c === 'high') return <Badge label="High" variant="green" />;
  if (c === 'medium') return <Badge label="Medium" variant="accent" />;
  if (c === 'low') return <Badge label="Low" variant="red" />;
  return <Badge label={c} variant="muted" />;
}

function fmt(ts: string | null) {
  if (ts == null) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ModifierCalibrations() {
  const { rows, loading, error } = useSupabaseRows<CalibrationRow>((s) =>
    s
      .from('modifier_calibrations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(80)
  );

  const calibrated = rows.filter((r) => r.calibrated_at != null).length;
  const highConf = rows.filter((r) => r.confidence === 'high').length;
  const totalSamples = rows.reduce((n, r) => n + r.sample_count, 0);

  return (
    <TablePage
      title="Modifier Calibrations"
      accent={theme.color.blue}
      subtitle={`${rows.length} active calibrations`}
      stats={[
        { label: 'Calibrated', value: calibrated, color: theme.color.green },
        { label: 'High conf', value: highConf, color: theme.color.green },
        {
          label: 'Total samples',
          value: totalSamples,
          color: theme.color.blue,
        },
      ]}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No modifier calibrations recorded yet."
      columnsTemplate="160px 1fr 80px 80px 80px 140px"
      columnLabels={[
        'Source',
        'User',
        'Adjust',
        'Bias',
        'Samples',
        'Updated',
      ]}
      keyOf={(r) => r.id}
      renderRow={(r) => (
        <>
          <span style={{ fontWeight: 600 }}>{r.modifier_source}</span>
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
          <span
            style={{
              color:
                r.adjustment > 1
                  ? theme.color.green
                  : r.adjustment < 1
                    ? theme.color.red
                    : theme.color.textDim,
            }}
          >
            ×{r.adjustment.toFixed(2)}
          </span>
          <span style={{ color: theme.color.textDim }}>
            {r.mean_bias != null ? r.mean_bias.toFixed(2) : '—'}
          </span>
          <span style={{ color: theme.color.textDim }}>{r.sample_count}</span>
          <div
            style={{ display: 'flex', gap: 6, alignItems: 'center' }}
          >
            {confidenceBadge(r.confidence)}
            <span style={{ color: theme.color.textMuted, fontSize: 10 }}>
              {fmt(r.updated_at)}
            </span>
          </div>
        </>
      )}
    />
  );
}
