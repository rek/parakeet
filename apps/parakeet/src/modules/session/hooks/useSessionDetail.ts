import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { PrescriptionTrace } from '@parakeet/training-engine';
import { qk } from '@platform/query';
import { captureException } from '@platform/utils/captureException';

import { getSession, getSessionLog } from '../application/session.service';
import { parseJitInputSnapshot, parsePrescriptionTrace } from '../data/session-codecs';

type JitSnapshot = ReturnType<typeof parseJitInputSnapshot>;

type SessionDetailResult =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'not-found' }
  | {
      status: 'ready';
      session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
      log: Awaited<ReturnType<typeof getSessionLog>>;
      jitSnapshot: JitSnapshot;
      prescriptionTrace: PrescriptionTrace | null;
    };

export function useSessionDetail({ sessionId }: { sessionId: string }): SessionDetailResult {
  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
  } = useQuery({
    queryKey: qk.session.detail(sessionId),
    queryFn: () => getSession(sessionId),
    enabled: !!sessionId,
  });

  const {
    data: log,
    isLoading: logLoading,
    error: logError,
  } = useQuery({
    queryKey: qk.session.log(sessionId),
    queryFn: () => getSessionLog(sessionId),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (sessionError) captureException(sessionError);
  }, [sessionError]);

  useEffect(() => {
    if (logError) captureException(logError);
  }, [logError]);

  const jitSnapshot = useMemo(
    () => parseJitInputSnapshot(session?.jit_input_snapshot),
    [session?.jit_input_snapshot]
  );

  const prescriptionTrace = useMemo(
    () => parsePrescriptionTrace(session?.jit_output_trace),
    [session?.jit_output_trace]
  );

  if (sessionLoading || logLoading) return { status: 'loading' };
  if (sessionError) return { status: 'error', error: sessionError };
  if (!session) return { status: 'not-found' };

  return { status: 'ready', session, log: log ?? null, jitSnapshot, prescriptionTrace };
}
