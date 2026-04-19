import { Badge } from '../components/Badge';
import { TablePage } from '../components/TablePage';
import { useSupabaseRows } from '../lib/useSupabaseRows';
import { theme } from '../lib/theme';

interface PartnerRow {
  id: string;
  created_at: string;
  updated_at: string;
  requester_id: string;
  responder_id: string;
  status: string;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadge(s: string) {
  if (s === 'accepted' || s === 'active')
    return <Badge label="Accepted" variant="green" />;
  if (s === 'pending') return <Badge label="Pending" variant="accent" />;
  if (s === 'declined' || s === 'rejected')
    return <Badge label="Declined" variant="red" />;
  if (s === 'revoked') return <Badge label="Revoked" variant="muted" />;
  return <Badge label={s} variant="muted" />;
}

export function GymPartners() {
  const { rows, loading, error } = useSupabaseRows<PartnerRow>((s) =>
    s
      .from('gym_partners')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(80)
  );

  const accepted = rows.filter(
    (r) => r.status === 'accepted' || r.status === 'active'
  ).length;
  const pending = rows.filter((r) => r.status === 'pending').length;
  const distinctUsers = new Set([
    ...rows.map((r) => r.requester_id),
    ...rows.map((r) => r.responder_id),
  ]).size;

  return (
    <TablePage
      title="Gym Partners"
      accent={theme.color.purple}
      subtitle={`${rows.length} relationships`}
      stats={[
        { label: 'Accepted', value: accepted, color: theme.color.green },
        { label: 'Pending', value: pending, color: theme.color.accent },
        {
          label: 'Distinct lifters',
          value: distinctUsers,
          color: theme.color.blue,
        },
      ]}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No gym-partner relationships yet."
      columnsTemplate="130px 1fr 1fr 100px 130px"
      columnLabels={['Requested', 'Requester', 'Responder', 'Status', 'Updated']}
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
            title={r.requester_id}
          >
            {r.requester_id.slice(0, 8)}
          </span>
          <span
            style={{
              color: theme.color.textDim,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={r.responder_id}
          >
            {r.responder_id.slice(0, 8)}
          </span>
          {statusBadge(r.status)}
          <span style={{ color: theme.color.textMuted, fontSize: 10 }}>
            {fmt(r.updated_at)}
          </span>
        </>
      )}
    />
  );
}
