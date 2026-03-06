import { useState } from 'react';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface Props {
  data: unknown;
  depth?: number;
  defaultCollapsed?: boolean;
  label?: string;
}

function colorizeValue(val: JsonValue): string {
  if (val === null) return 'var(--red)';
  if (typeof val === 'boolean') return 'var(--purple)';
  if (typeof val === 'number') return 'var(--accent)';
  if (typeof val === 'string') return 'var(--green)';
  return 'var(--text)';
}

function formatPrimitive(val: JsonValue): string {
  if (val === null) return 'null';
  if (typeof val === 'string') return `"${val}"`;
  return String(val);
}

function isPrimitive(val: unknown): val is string | number | boolean | null {
  return val === null || typeof val !== 'object';
}

function NodeToggle({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--accent)',
        fontSize: '10px',
        padding: '0 4px 0 0',
        fontFamily: 'var(--mono)',
        lineHeight: 1,
        opacity: 0.8,
      }}
    >
      {expanded ? '▾' : '▸'}
    </button>
  );
}

function JsonNode({ keyName, value, depth, defaultCollapsed }: {
  keyName?: string;
  value: JsonValue;
  depth: number;
  defaultCollapsed: boolean;
}) {
  const [expanded, setExpanded] = useState(!defaultCollapsed || depth < 1);

  if (isPrimitive(value)) {
    return (
      <div style={{ display: 'flex', gap: '4px', paddingLeft: depth * 14 }}>
        {keyName !== undefined && (
          <span style={{ color: 'var(--blue)', opacity: 0.85 }}>"{keyName}":</span>
        )}
        <span style={{ color: colorizeValue(value) }}>{formatPrimitive(value)}</span>
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as JsonValue[]).map((v, i) => [String(i), v] as [string, JsonValue])
    : Object.entries(value as Record<string, JsonValue>);
  const count = entries.length;
  const open = isArray ? '[' : '{';
  const close = isArray ? ']' : '}';

  if (count === 0) {
    return (
      <div style={{ display: 'flex', gap: '4px', paddingLeft: depth * 14 }}>
        {keyName !== undefined && (
          <span style={{ color: 'var(--blue)', opacity: 0.85 }}>"{keyName}":</span>
        )}
        <span style={{ color: 'var(--text-dim)' }}>{open}{close}</span>
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: depth * 14 }}>
      <button
        className="btn-reset"
        style={{ display: 'flex', alignItems: 'center', gap: '2px', userSelect: 'none' }}
        onClick={() => setExpanded(!expanded)}
      >
        <NodeToggle expanded={expanded} onClick={() => setExpanded(!expanded)} />
        {keyName !== undefined && (
          <span style={{ color: 'var(--blue)', opacity: 0.85 }}>"{keyName}":</span>
        )}
        <span style={{ color: 'var(--text-dim)' }}>
          {open}
          {!expanded && (
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              {' '}{count} {isArray ? 'items' : 'keys'}{' '}
            </span>
          )}
          {!expanded && close}
        </span>
      </button>
      {expanded && (
        <div style={{ borderLeft: '1px solid var(--border)', marginLeft: 5 }}>
          {entries.map(([k, v]) => (
            <JsonNode
              key={k}
              keyName={isArray ? undefined : k}
              value={v}
              depth={depth + 1}
              defaultCollapsed={defaultCollapsed}
            />
          ))}
        </div>
      )}
      {expanded && (
        <div style={{ color: 'var(--text-dim)' }}>{close}</div>
      )}
    </div>
  );
}

export function JsonViewer({ data, depth = 0, defaultCollapsed = true, label }: Props) {
  const [open, setOpen] = useState(!defaultCollapsed);

  if (data === null || data === undefined) {
    return <span style={{ color: 'var(--text-muted)' }}>null</span>;
  }

  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      {label && (
        <button
          className="btn-reset"
          onClick={() => setOpen(!open)}
          style={{
            padding: '6px 10px',
            background: 'var(--surface)',
            borderBottom: open ? '1px solid var(--border)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            userSelect: 'none',
          }}
        >
          <span style={{ color: 'var(--accent)', fontSize: 10 }}>{open ? '▾' : '▸'}</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </span>
        </button>
      )}
      {open && (
        <div style={{
          padding: '10px 12px',
          overflowX: 'auto',
          fontSize: 12,
          lineHeight: 1.7,
          maxHeight: 400,
          overflowY: 'auto',
        }}>
          <JsonNode
            value={data as JsonValue}
            depth={depth}
            defaultCollapsed={defaultCollapsed}
          />
        </div>
      )}
    </div>
  );
}
