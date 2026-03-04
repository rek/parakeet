import { useState } from 'react';
import { Logs } from './Logs';
import { JITLogs } from './JITLogs';
import { ComparisonLogs } from './ComparisonLogs';
import { CycleReviews } from './CycleReviews';
import { FormulaSuggestions } from './FormulaSuggestions';
import { DeveloperSuggestions } from './DeveloperSuggestions';

type Page =
  | 'timeline'
  | 'jit'
  | 'hybrid'
  | 'cycle_reviews'
  | 'formula'
  | 'developer';

interface NavItem {
  id: Page;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const NAV: NavItem[] = [
  { id: 'timeline',     label: 'Timeline',              icon: '◈', color: 'var(--accent)',  description: 'All AI events' },
  { id: 'jit',          label: 'JIT Sessions',          icon: '⚡', color: 'var(--accent)',  description: 'Session adjustments' },
  { id: 'hybrid',       label: 'Hybrid Comparisons',    icon: '⚖', color: 'var(--purple)', description: 'Formula vs LLM diffs' },
  { id: 'cycle_reviews',label: 'Cycle Reviews',         icon: '◎', color: 'var(--green)',  description: 'Sonnet analysis' },
  { id: 'formula',      label: 'Formula Suggestions',   icon: '∫', color: 'var(--blue)',   description: 'AI formula overrides' },
  { id: 'developer',    label: 'Dev Suggestions',       icon: '◈', color: 'var(--red)',    description: 'Structural feedback' },
];

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--mono)',
        textAlign: 'left',
        transition: 'all 0.12s ease',
        background: active
          ? `rgba(${item.color === 'var(--accent)' ? '245,158,11' : item.color === 'var(--purple)' ? '167,139,250' : item.color === 'var(--green)' ? '52,211,153' : item.color === 'var(--blue)' ? '96,165,250' : '248,113,113'}, 0.12)`
          : hovered
            ? 'var(--surface-hover)'
            : 'transparent',
      }}
    >
      <span style={{
        fontSize: 14,
        color: active ? item.color : 'var(--text-muted)',
        width: 18,
        textAlign: 'center',
        flexShrink: 0,
        transition: 'color 0.12s',
      }}>
        {item.icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: active ? 600 : 400,
          color: active ? item.color : hovered ? 'var(--text)' : 'var(--text-dim)',
          transition: 'color 0.12s',
          letterSpacing: '-0.01em',
        }}>
          {item.label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.2 }}>
          {item.description}
        </div>
      </div>

      {active && (
        <div style={{
          marginLeft: 'auto',
          width: 3,
          height: 20,
          borderRadius: 2,
          background: item.color,
          flexShrink: 0,
          boxShadow: `0 0 8px ${item.color}`,
        }} />
      )}
    </button>
  );
}

function PageContent({ page }: { page: Page }) {
  switch (page) {
    case 'timeline':      return <Logs />;
    case 'jit':           return <JITLogs />;
    case 'hybrid':        return <ComparisonLogs />;
    case 'cycle_reviews': return <CycleReviews />;
    case 'formula':       return <FormulaSuggestions />;
    case 'developer':     return <DeveloperSuggestions />;
    default:              return <Logs />;
  }
}

export function App() {
  const [page, setPage] = useState<Page>('timeline');

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'var(--mono)',
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: '18px 16px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 4,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'var(--accent-dim)',
              border: '1px solid rgba(245,158,11,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 14, color: 'var(--accent)' }}>🦜</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)', letterSpacing: '-0.02em' }}>
                Parakeet
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                AI Telemetry
              </div>
            </div>
          </div>
          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--green)',
              animation: 'pulse-dot 2s ease-in-out infinite',
              boxShadow: '0 0 6px var(--green)',
            }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              connected · local supabase
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 12px 6px', marginTop: 2 }}>
            Views
          </div>
          {NAV.map(item => (
            <NavButton
              key={item.id}
              item={item}
              active={page === item.id}
              onClick={() => setPage(item.id)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border)',
          fontSize: 10,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          <div style={{ marginBottom: 2 }}>Models</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--green)', fontSize: 9 }}>●</span>
              <span>claude-haiku-4-5 (JIT)</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--blue)', fontSize: 9 }}>●</span>
              <span>claude-sonnet-4-6 (Review)</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '28px 32px',
      }}>
        <div
          key={page}
          style={{ maxWidth: 900, margin: '0 auto' }}
          className="animate-fade-in"
        >
          <PageContent page={page} />
        </div>
      </main>
    </div>
  );
}

export default App;
