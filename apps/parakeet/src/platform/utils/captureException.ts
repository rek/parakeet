import * as Sentry from '@sentry/react-native';

export function captureException(
  error: unknown,
  options?: { extra?: Record<string, unknown> }
): void {
  const captureContext = options?.extra ? { extra: options.extra } : undefined;

  if (error instanceof Error) {
    Sentry.captureException(error, captureContext);
    return;
  }

  if (typeof error === 'string') {
    Sentry.captureException(new Error(error), captureContext);
    return;
  }

  Sentry.captureException(JSON.stringify(error), captureContext);
}

/**
 * Leave a Sentry breadcrumb + logcat line. Used to trace multi-step async flows
 * where wrapping every branch in captureException would drown the issue list,
 * but we still want a trail when the next error lands.
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    level: 'info',
    data,
  });
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[${category}] ${message}`, data ?? '');
  }
}
