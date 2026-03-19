/**
 * Portable alternative to AbortSignal.timeout() which is unavailable in Hermes.
 *
 * Returns an AbortSignal that aborts after the given milliseconds.
 */
export function abortAfter(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}
