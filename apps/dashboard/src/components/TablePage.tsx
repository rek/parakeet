import { ReactNode } from 'react';

import { theme } from '../lib/theme';

interface Stat {
  label: string;
  value: ReactNode;
  color?: string;
}

export interface TablePageProps<T> {
  title: string;
  /** Hex/var color for the leading dot in the title row. */
  accent?: string;
  /** Subtitle shown next to the title (e.g. "Last 50 entries"). */
  subtitle?: string;
  /** Top-line stats rendered as label/value pairs. */
  stats?: Stat[];
  /** Loading state from the data fetch. */
  loading: boolean;
  /** Error message from the data fetch — shown above the table when present. */
  error?: string | null;
  rows: T[];
  /** CSS grid-template-columns for both the header row and each data row. */
  columnsTemplate: string;
  /** Column header labels — same order as the row renderer's cells. */
  columnLabels: string[];
  /** Empty-state message when rows is [] and not loading. */
  emptyMessage: string;
  /** Renders each row's cells in a single fragment, in the same column order. */
  renderRow: (row: T, index: number) => ReactNode;
  /** Stable key per row. */
  keyOf: (row: T, index: number) => string;
}

/**
 * Generic table page shell shared by the dashboard's list views.
 * Matches the layout of WorkoutSummaries / Logs etc. so the new pages
 * blend in with the existing design language.
 */
export function TablePage<T>({
  title,
  accent = theme.color.accent,
  subtitle,
  stats,
  loading,
  error,
  rows,
  columnsTemplate,
  columnLabels,
  emptyMessage,
  renderRow,
  keyOf,
}: TablePageProps<T>) {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 16, color: accent }}>&#9679;</span>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: theme.color.textBright,
              fontFamily: theme.font.mono,
              margin: 0,
            }}
          >
            {title}
          </h2>
          {subtitle != null && (
            <span
              style={{
                fontSize: 11,
                color: theme.color.textMuted,
                fontFamily: theme.font.mono,
              }}
            >
              {subtitle}
            </span>
          )}
        </div>

        {stats && stats.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 16,
              fontSize: 11,
              fontFamily: theme.font.mono,
              flexWrap: 'wrap',
            }}
          >
            {stats.map((s) => (
              <div key={s.label}>
                <span style={{ color: theme.color.textMuted }}>{s.label}: </span>
                <span style={{ color: s.color ?? accent, fontWeight: 600 }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            color: theme.color.red,
            border: `1px solid ${theme.border.red}`,
            background: theme.bg.redDim,
            borderRadius: 4,
            padding: '8px 12px',
            fontFamily: theme.font.mono,
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={messageStyle}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={messageStyle}>{emptyMessage}</div>
      ) : (
        <div
          style={{
            background: theme.bg.surface,
            border: `1px solid ${theme.border.base}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: columnsTemplate,
              gap: 10,
              padding: '8px 14px',
              borderBottom: `1px solid ${theme.border.base}`,
              fontSize: 10,
              fontFamily: theme.font.mono,
              color: theme.color.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {columnLabels.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
          {rows.map((row, i) => (
            <div
              key={keyOf(row, i)}
              style={{
                display: 'grid',
                gridTemplateColumns: columnsTemplate,
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderBottom: `1px solid ${theme.border.base}`,
                fontSize: 12,
                fontFamily: theme.font.mono,
                color: theme.color.text,
              }}
            >
              {renderRow(row, i)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const messageStyle = {
  color: theme.color.textMuted,
  fontFamily: theme.font.mono,
  fontSize: 12,
} as const;
