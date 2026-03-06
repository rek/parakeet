import { theme } from '../lib/theme';

interface BadgeProps {
  label: string;
  variant?: 'accent' | 'blue' | 'green' | 'red' | 'purple' | 'muted';
}

const variants = {
  accent: { color: theme.color.accent, bg: theme.bg.accentDim,    border: theme.border.accent },
  blue:   { color: theme.color.blue,   bg: theme.bg.blueDim,      border: theme.border.blue },
  green:  { color: theme.color.green,  bg: theme.bg.greenDim,     border: theme.border.green },
  red:    { color: theme.color.red,    bg: theme.bg.redDim,       border: theme.border.red },
  purple: { color: theme.color.purple, bg: theme.bg.purpleDim,    border: theme.border.purple },
  muted:  { color: theme.color.textDim, bg: theme.bg.surfaceOverlay, border: theme.border.base },
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
