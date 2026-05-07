/**
 * Error reporter hook for engine code.
 *
 * Engine packages can't import the app's Sentry helper directly, so callers
 * register a reporter at bootstrap and the engine forwards exceptions to it.
 *
 * Empty catches are forbidden (see `feedback_always_capture_exceptions`).
 * Every catch in engine code must call `reportEngineError`.
 */

export type EngineErrorContext = {
  source: string;
  attempt?: number;
  [key: string]: unknown;
};

type EngineErrorReporter = (err: unknown, ctx: EngineErrorContext) => void;

let reporter: EngineErrorReporter | null = null;

export function configureEngineErrorReporter(fn: EngineErrorReporter | null) {
  reporter = fn;
}

export function reportEngineError(err: unknown, ctx: EngineErrorContext) {
  const name = err instanceof Error ? err.name : 'unknown';
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${ctx.source}] ${name}: ${message}`, { err, ctx });
  if (reporter) {
    try {
      reporter(err, ctx);
    } catch (reporterErr) {
      console.error('[engine-error-reporter] reporter threw', reporterErr);
    }
  }
}
