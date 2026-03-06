import { useEffect, useState } from 'react';
import type { DbRow } from '@platform/supabase';
import { Badge } from '../components/Badge';
import { JsonViewer } from '../components/JsonViewer';
import { useSupabase } from '../lib/SupabaseContext';
import { theme } from '../lib/theme';

type FormulaConfig = DbRow<'formula_configs'>;

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FormulaCard({ config }: { config: FormulaConfig }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${config.source === 'ai_suggestion' ? theme.border.blue : theme.border.base}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        className="btn-reset"
        style={{
          padding: '12px 16px',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ color: 'var(--accent)', fontSize: 10, flexShrink: 0 }}>
          {expanded ? '▾' : '▸'}
        </span>

        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 3,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
              {fmt(config.created_at)}
            </span>
            <Badge
              label={
                config.source === 'ai_suggestion'
                  ? 'AI Suggestion'
                  : config.source
              }
              variant={config.source === 'ai_suggestion' ? 'blue' : 'muted'}
            />
            {config.is_active ? (
              <Badge label="Active" variant="green" />
            ) : (
              <Badge label="Inactive" variant="muted" />
            )}
            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
              v{config.version}
            </span>
          </div>
          {config.ai_rationale && (
            <p
              style={{
                color: 'var(--text-dim)',
                fontSize: 12,
                lineHeight: 1.5,
                fontStyle: 'italic',
              }}
            >
              "{config.ai_rationale.slice(0, 140)}
              {config.ai_rationale.length > 140 ? '…' : ''}"
            </p>
          )}
        </div>

        {/* Override count */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Overrides
          </div>
          <div style={{ color: 'var(--blue)', fontWeight: 700, fontSize: 16 }}>
            {Object.keys(config.overrides ?? {}).length}
          </div>
        </div>
      </button>

      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {config.ai_rationale && (
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
                AI Rationale
              </div>
              <p
                style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.8 }}
              >
                {config.ai_rationale}
              </p>
            </div>
          )}

          {/* Overrides as key-value pairs */}
          {config.overrides && Object.keys(config.overrides).length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 8,
                }}
              >
                Parameter Overrides
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(config.overrides).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      padding: '5px 10px',
                      background: 'var(--bg)',
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--blue)',
                        fontSize: 12,
                        fontWeight: 500,
                        flex: 1,
                      }}
                    >
                      {k}
                    </span>
                    <span
                      style={{
                        color: 'var(--accent)',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {JSON.stringify(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <JsonViewer
            data={config.overrides}
            label="Raw Overrides JSON"
            defaultCollapsed={false}
          />
        </div>
      )}
    </div>
  );
}

export function FormulaSuggestions() {
  const { supabase } = useSupabase();
  const [configs, setConfigs] = useState<FormulaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'ai' | 'manual'>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('formula_configs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) setError(error.message);
      else setConfigs((data ?? []) as FormulaConfig[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const filtered = configs.filter((c) => {
    if (filter === 'ai') return c.source === 'ai_suggestion';
    if (filter === 'manual') return c.source !== 'ai_suggestion';
    return true;
  });

  const aiCount = configs.filter((c) => c.source === 'ai_suggestion').length;

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
            Formula Suggestions
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            AI-proposed formula parameter overrides from cycle review analysis
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'ai', 'manual'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid',
                borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
                background: filter === f ? 'var(--accent-dim)' : 'transparent',
                color: filter === f ? 'var(--accent)' : 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--mono)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {f === 'ai'
                ? `AI (${aiCount})`
                : f.charAt(0).toUpperCase() + f.slice(1)}
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
          Loading formula configs…
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
          No formula configs found.
        </div>
      )}

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        className="animate-stagger"
      >
        {filtered.map((c) => (
          <FormulaCard key={c.id} config={c} />
        ))}
      </div>
    </div>
  );
}
