import { useEffect, useState } from 'react';
import type { DbRow } from '@platform/supabase';
import { priorityBadge, statusBadge } from '../components/Badge';
import { supabase } from '../lib/supabase';

type DeveloperSuggestion = DbRow<'developer_suggestions'>;

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SuggestionCard({ suggestion }: { suggestion: DeveloperSuggestion }) {
  const [expanded, setExpanded] = useState(false);

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const priorityColor = {
    high: 'var(--red)',
    medium: 'var(--accent)',
    low: 'var(--text-dim)',
  };
  const pColor =
    priorityColor[suggestion.priority as keyof typeof priorityColor] ??
    'var(--text-dim)';

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${suggestion.priority === 'high' ? 'rgba(248,113,113,0.2)' : 'var(--border)'}`,
        borderLeft: `3px solid ${pColor}`,
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
    >
      <div
        style={{ padding: '13px 16px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span
            style={{
              color: 'var(--accent)',
              fontSize: 10,
              marginTop: 4,
              flexShrink: 0,
            }}
          >
            {expanded ? '▾' : '▸'}
          </span>

          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 5,
                flexWrap: 'wrap',
              }}
            >
              {priorityBadge(suggestion.priority)}
              {statusBadge(suggestion.status)}
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {fmt(suggestion.created_at)}
              </span>
            </div>
            <p
              style={{
                color: 'var(--text-bright)',
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 4,
                lineHeight: 1.5,
              }}
            >
              {suggestion.description}
            </p>
            <p
              style={{
                color: 'var(--text-dim)',
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {suggestion.rationale.slice(0, 160)}
              {suggestion.rationale.length > 160 ? '…' : ''}
            </p>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div
            style={{
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {/* Description */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                Full Description
              </div>
              <p
                style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.8 }}
              >
                {suggestion.description}
              </p>
            </div>

            {/* Rationale */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                Rationale
              </div>
              <p
                style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.8 }}
              >
                {suggestion.rationale}
              </p>
            </div>

            {/* Developer note */}
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--purple-dim)',
                borderRadius: 6,
                border: '1px solid rgba(167,139,250,0.2)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--purple)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                  fontWeight: 700,
                }}
              >
                Developer Note
              </div>
              <p
                style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.8 }}
              >
                {suggestion.developer_note}
              </p>
            </div>

            {/* Meta */}
            <div
              style={{
                display: 'flex',
                gap: 20,
                flexWrap: 'wrap',
                fontSize: 12,
                color: 'var(--text-muted)',
                paddingTop: 4,
                borderTop: '1px solid var(--border)',
              }}
            >
              <span>ID: {suggestion.id.slice(0, 8)}…</span>
              {suggestion.program_id && (
                <span>Program: {suggestion.program_id.slice(0, 8)}…</span>
              )}
              {suggestion.reviewed_at && (
                <span>Reviewed: {fmt(suggestion.reviewed_at)}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DeveloperSuggestions() {
  const [suggestions, setSuggestions] = useState<DeveloperSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('developer_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) setError(error.message);
      else setSuggestions((data ?? []) as DeveloperSuggestion[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered =
    filter === 'all'
      ? suggestions
      : filter === 'unreviewed'
        ? suggestions.filter((s) => !s.is_reviewed)
        : suggestions.filter((s) => s.priority === filter);

  const unreviewedCount = suggestions.filter((s) => !s.is_reviewed).length;

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'unreviewed', label: `Unreviewed (${unreviewedCount})` },
    { key: 'high', label: 'High' },
    { key: 'medium', label: 'Medium' },
    { key: 'low', label: 'Low' },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text-bright)',
              marginBottom: 4,
            }}
          >
            Developer Suggestions
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            Structural suggestions from Claude Sonnet — high-level observations
            requiring code changes
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid',
                borderColor:
                  filter === f.key ? 'var(--accent)' : 'var(--border)',
                background:
                  filter === f.key ? 'var(--accent-dim)' : 'transparent',
                color: filter === f.key ? 'var(--accent)' : 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--mono)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div
          style={{
            color: 'var(--text-dim)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              animation: 'pulse-dot 1s ease infinite',
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent)',
            }}
          />
          Loading suggestions…
        </div>
      )}
      {error && (
        <div
          style={{
            color: 'var(--red)',
            padding: '8px 12px',
            background: 'var(--red-dim)',
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div
          style={{
            color: 'var(--text-muted)',
            padding: '40px 0',
            textAlign: 'center',
            fontSize: 13,
          }}
        >
          No suggestions found. Complete a cycle to generate them.
        </div>
      )}

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        className="animate-stagger"
      >
        {filtered.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} />
        ))}
      </div>
    </div>
  );
}
