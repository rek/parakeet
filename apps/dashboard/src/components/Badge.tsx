interface BadgeProps {
  label: string;
  variant?: 'accent' | 'blue' | 'green' | 'red' | 'purple' | 'muted';
}

const variants = {
  accent: { color: 'var(--accent)', bg: 'var(--accent-dim)', border: 'rgba(245,158,11,0.25)' },
  blue:   { color: 'var(--blue)',   bg: 'var(--blue-dim)',   border: 'rgba(96,165,250,0.2)' },
  green:  { color: 'var(--green)',  bg: 'var(--green-dim)',  border: 'rgba(52,211,153,0.2)' },
  red:    { color: 'var(--red)',    bg: 'var(--red-dim)',    border: 'rgba(248,113,113,0.2)' },
  purple: { color: 'var(--purple)', bg: 'var(--purple-dim)', border: 'rgba(167,139,250,0.2)' },
  muted:  { color: 'var(--text-dim)', bg: 'rgba(255,255,255,0.04)', border: 'var(--border)' },
};

export function Badge({ label, variant = 'muted' }: BadgeProps) {
  const v = variants[variant];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 3,
      fontSize: 10,
      fontFamily: 'var(--mono)',
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: v.color,
      background: v.bg,
      border: `1px solid ${v.border}`,
    }}>
      {label}
    </span>
  );
}

export function strategyBadge(strategy: string) {
  if (strategy === 'llm') return <Badge label="LLM" variant="green" />;
  if (strategy === 'formula') return <Badge label="Formula" variant="blue" />;
  if (strategy === 'hybrid') return <Badge label="Hybrid" variant="purple" />;
  if (strategy === 'auto') return <Badge label="Auto" variant="accent" />;
  return <Badge label={strategy} variant="muted" />;
}

export function priorityBadge(priority: string) {
  if (priority === 'high') return <Badge label="High" variant="red" />;
  if (priority === 'medium') return <Badge label="Medium" variant="accent" />;
  return <Badge label="Low" variant="muted" />;
}

export function statusBadge(status: string) {
  if (status === 'implemented') return <Badge label="Implemented" variant="green" />;
  if (status === 'acknowledged') return <Badge label="Acknowledged" variant="blue" />;
  if (status === 'dismissed') return <Badge label="Dismissed" variant="muted" />;
  return <Badge label="Unreviewed" variant="accent" />;
}
