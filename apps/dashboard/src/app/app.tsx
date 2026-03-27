import { useEffect, useState } from 'react';

import { isEnvAvailable } from '../lib/supabase';
import { useSupabase } from '../lib/SupabaseContext';
import { theme } from '../lib/theme';
import { ChallengeReviews } from './ChallengeReviews';
import { ComparisonLogs } from './ComparisonLogs';
import { CycleReviews } from './CycleReviews';
import { DecisionReplay } from './DecisionReplay';
import { DeveloperSuggestions } from './DeveloperSuggestions';
import { FormulaSuggestions } from './FormulaSuggestions';
import { JITLogs } from './JITLogs';
import { Logs } from './Logs';
import { MotivationalLogs } from './MotivationalLogs';
import { WorkoutSummaries } from './WorkoutSummaries';

type ThemeId = 'default' | 'hot-pink';

const THEMES: { id: ThemeId; color: string; label: string }[] = [
  { id: 'default', color: '#f59e0b', label: 'amber' },
  { id: 'hot-pink', color: '#ec4899', label: 'pink' },
];

function useTheme() {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    return (localStorage.getItem('dashboard-theme') as ThemeId) ?? 'default';
  });

  useEffect(() => {
    if (themeId === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = themeId;
    }
    localStorage.setItem('dashboard-theme', themeId);
  }, [themeId]);

  return { themeId, setThemeId };
}

type Page =
  | 'timeline'
  | 'jit'
  | 'workouts'
  | 'motivational'
  | 'challenge'
  | 'replay'
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
  {
    id: 'timeline',
    label: 'Timeline',
    icon: '◈',
    color: 'var(--accent)',
    description: 'All AI events',
  },
  {
    id: 'jit',
    label: 'JIT Sessions',
    icon: '⚡',
    color: 'var(--accent)',
    description: 'Session adjustments',
  },
  {
    id: 'workouts',
    label: 'Workout Summaries',
    icon: '●',
    color: 'var(--green)',
    description: 'Completed sessions',
  },
  {
    id: 'motivational',
    label: 'Motivational Msgs',
    icon: '✦',
    color: 'var(--accent)',
    description: 'LLM input + output',
  },
  {
    id: 'challenge',
    label: 'Challenge Reviews',
    icon: '⚑',
    color: 'var(--accent)',
    description: 'Post-hoc JIT judge',
  },
  {
    id: 'replay',
    label: 'Decision Replay',
    icon: '↺',
    color: 'var(--blue)',
    description: 'Prescription accuracy',
  },
  {
    id: 'hybrid',
    label: 'Hybrid Comparisons',
    icon: '⚖',
    color: 'var(--purple)',
    description: 'Formula vs LLM diffs',
  },
  {
    id: 'cycle_reviews',
    label: 'Cycle Reviews',
    icon: '◎',
    color: 'var(--green)',
    description: 'Sonnet analysis',
  },
  {
    id: 'formula',
    label: 'Formula Suggestions',
    icon: '∫',
    color: 'var(--blue)',
    description: 'AI formula overrides',
  },
  {
    id: 'developer',
    label: 'Dev Suggestions',
    icon: '◈',
    color: 'var(--red)',
    description: 'Structural feedback',
  },
];

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
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
          ? ({
              'var(--accent)': 'var(--accent-dim)',
              'var(--green)': 'var(--green-dim)',
              'var(--purple)': 'var(--purple-dim)',
              'var(--blue)': 'var(--blue-dim)',
              'var(--red)': 'var(--red-dim)',
            }[item.color] ?? 'var(--accent-dim)')
          : hovered
            ? 'var(--surface-hover)'
            : 'transparent',
      }}
    >
      <span
        style={{
          fontSize: 14,
          color: active ? item.color : 'var(--text-muted)',
          width: 18,
          textAlign: 'center',
          flexShrink: 0,
          transition: 'color 0.12s',
        }}
      >
        {item.icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: active ? 600 : 400,
            color: active
              ? item.color
              : hovered
                ? 'var(--text)'
                : 'var(--text-dim)',
            transition: 'color 0.12s',
            letterSpacing: '-0.01em',
          }}
        >
          {item.label}
        </div>
        <div
          style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.2 }}
        >
          {item.description}
        </div>
      </div>

      {active && (
        <div
          style={{
            marginLeft: 'auto',
            width: 3,
            height: 20,
            borderRadius: 2,
            background: item.color,
            flexShrink: 0,
            boxShadow: `0 0 8px ${item.color}`,
          }}
        />
      )}
    </button>
  );
}

function PageContent({ page }: { page: Page }) {
  switch (page) {
    case 'timeline':
      return <Logs />;
    case 'jit':
      return <JITLogs />;
    case 'workouts':
      return <WorkoutSummaries />;
    case 'motivational':
      return <MotivationalLogs />;
    case 'challenge':
      return <ChallengeReviews />;
    case 'replay':
      return <DecisionReplay />;
    case 'hybrid':
      return <ComparisonLogs />;
    case 'cycle_reviews':
      return <CycleReviews />;
    case 'formula':
      return <FormulaSuggestions />;
    case 'developer':
      return <DeveloperSuggestions />;
    default:
      return <Logs />;
  }
}

// keep in sync with packages/training-engine/src/ai/models.ts
const jitModel = 'gpt-4o-mini';
const reviewModel = 'gpt-5';

export function App() {
  const [page, setPage] = useState<Page>('timeline');
  const { env, setEnv } = useSupabase();
  const { themeId, setThemeId } = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'var(--mono)',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '18px 16px 14px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'var(--accent-dim)',
                border: `1px solid ${theme.border.accentStrong}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 14, color: 'var(--accent)' }}>🦜</span>
            </div>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-bright)',
                  letterSpacing: '-0.02em',
                }}
              >
                Parakeet
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                AI Telemetry
              </div>
            </div>
          </div>
          {/* Env toggle */}
          <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
            {(['local', 'prod'] as const).map((e) => {
              const available = isEnvAvailable(e);
              const active = env === e;
              return (
                <button
                  key={e}
                  onClick={() => available && setEnv(e)}
                  title={available ? `Switch to ${e}` : `${e} not configured`}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    borderRadius: 4,
                    border: active
                      ? `1px solid ${e === 'prod' ? 'var(--red)' : 'var(--green)'}`
                      : '1px solid var(--border)',
                    background: active
                      ? e === 'prod'
                        ? theme.bg.redDim
                        : theme.bg.greenDim
                      : 'transparent',
                    color: active
                      ? e === 'prod'
                        ? 'var(--red)'
                        : 'var(--green)'
                      : available
                        ? 'var(--text-dim)'
                        : 'var(--text-muted)',
                    fontSize: 10,
                    fontFamily: 'var(--mono)',
                    cursor: available ? 'pointer' : 'not-allowed',
                    opacity: available ? 1 : 0.4,
                    letterSpacing: '0.04em',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nav */}
        <nav
          style={{
            flex: 1,
            padding: '10px 8px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              padding: '4px 12px 6px',
              marginTop: 2,
            }}
          >
            Views
          </div>
          {NAV.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={page === item.id}
              onClick={() => setPage(item.id)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--border)',
            fontSize: 10,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}
        >
          <div style={{ marginBottom: 2 }}>Models</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--green)', fontSize: 9 }}>●</span>
              <span>{jitModel} (JIT)</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--blue)', fontSize: 9 }}>●</span>
              <span>{reviewModel} (Review)</span>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ marginBottom: 4 }}>Theme</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  title={t.label}
                  style={{
                    background: 'none',
                    border: `1px solid ${themeId === t.id ? t.color : 'var(--border)'}`,
                    borderRadius: 4,
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: t.color,
                    fontFamily: 'var(--mono)',
                    opacity: themeId === t.id ? 1 : 0.45,
                    letterSpacing: '0.02em',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '28px 32px',
        }}
      >
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
