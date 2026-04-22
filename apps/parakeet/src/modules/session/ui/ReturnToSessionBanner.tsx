// @spec docs/features/session/spec-lifecycle.md
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { getRestTimerPrefs } from '@modules/settings';
import {
  selectActiveTimer,
  useSessionStore,
} from '../store/sessionStore';
import { sessionLabel } from '@shared/utils/string';
import * as Haptics from 'expo-haptics';
import { router, usePathname } from 'expo-router';

import { formatMMSS } from '../../../shared/utils';
import { radii, spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { detectOvertimeEdge } from '../utils/overtime-edge';

export function ReturnToSessionBanner() {
  const { colors } = useTheme();
  const sessionId = useSessionStore((s) => s.sessionId);
  const sessionMeta = useSessionStore((s) => s.sessionMeta);
  const cachedJitData = useSessionStore((s) => s.cachedJitData);
  const activeTimer = useSessionStore(selectActiveTimer);
  const hasTimers = useSessionStore((s) => Object.keys(s.timers).length > 0);

  const pathname = usePathname();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
          backgroundColor: colors.primary,
          borderRadius: radii.full,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
        },
        pillOvertime: {
          backgroundColor: colors.warning,
        },
        label: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.textInverse,
          flexShrink: 1,
        },
        rest: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.bold,
          color: colors.textInverse,
        },
        restOvertime: {
          color: colors.textInverse,
        },
      }),
    [colors]
  );

  // Edge-detector ref: resets whenever a new timer starts or closes
  const prevOvertimeRef = useRef(false);
  const hapticAlertRef = useRef(true); // matches RestTimerPrefs default

  // Load haptic preference once
  useEffect(() => {
    getRestTimerPrefs().then((p) => {
      hapticAlertRef.current = p.hapticAlert;
    });
  }, []);

  // Reset edge detector when the timer changes (new rest interval or closes)
  useEffect(() => {
    prevOvertimeRef.current = false;
  }, [activeTimer?.visible, activeTimer?.durationSeconds]);

  // Local tick to force re-render every second for live countdown
  // Also checks for haptic trigger via getState() to avoid stale closure
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!hasTimers) return;
    const id = setInterval(() => {
      setTick((n) => n + 1);

      // Read fresh active timer to avoid stale closure
      const state = useSessionStore.getState();
      const ts = selectActiveTimer(state);
      if (!ts) return;

      const elapsed =
        ts.timerStartedAt != null
          ? Math.floor((Date.now() - ts.timerStartedAt) / 1000)
          : ts.elapsed;
      const remaining = ts.durationSeconds + ts.offset - elapsed;

      if (
        detectOvertimeEdge(prevOvertimeRef.current, remaining) &&
        hapticAlertRef.current &&
        AppState.currentState === 'active'
      ) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      prevOvertimeRef.current = remaining <= 0;
    }, 1000);
    return () => clearInterval(id);
  }, [hasTimers]);

  if (!sessionId) return null;
  if (pathname.startsWith('/session')) return null;

  const liftLabel = sessionMeta ? sessionLabel(sessionMeta) : 'Session';

  const blockLabel = sessionMeta
    ? sessionMeta.block_number !== null
      ? `Block ${sessionMeta.block_number} · Week ${sessionMeta.week_number}`
      : `Week ${sessionMeta.week_number}`
    : '';

  let restLabel = 'In progress →';
  let overtime = false;
  if (hasTimers && activeTimer) {
    const elapsed =
      activeTimer.timerStartedAt != null
        ? Math.floor((Date.now() - activeTimer.timerStartedAt) / 1000)
        : activeTimer.elapsed;
    const remaining = activeTimer.durationSeconds + activeTimer.offset - elapsed;
    overtime = remaining <= 0;
    restLabel = overtime ? 'Rest done' : `Rest: ${formatMMSS(remaining)}`;
  }

  function handlePress() {
    router.push({
      pathname: '/session/[sessionId]',
      params: {
        sessionId: sessionId!,
        jitData: cachedJitData ?? '',
        openHistory: '1',
      },
    });
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={[styles.pill, overtime && styles.pillOvertime]}
    >
      <Text style={styles.label} numberOfLines={1}>
        {liftLabel}
        {blockLabel ? `  ·  ${blockLabel}` : ''}
      </Text>
      <Text style={[styles.rest, overtime && styles.restOvertime]}>
        {restLabel}
      </Text>
    </TouchableOpacity>
  );
}
