/**
 * Persistent cache for MediaPipe `.task` model files.
 *
 * Model downloads are 5.6–29MB from a public CDN. The browser's default
 * HTTP cache treats them as cache-control-respecting, but with the
 * DevTools "Disable cache" toggle (which we leave on during development)
 * or on a fresh session, the user pays the full download on every
 * dashboard reload.
 *
 * This module uses the Cache Storage API to persist downloads across
 * sessions independently of the HTTP cache. Returns a `Uint8Array` that
 * the caller can pass to `PoseLandmarker.createFromOptions` via
 * `baseOptions.modelAssetBuffer`.
 */

const CACHE_NAME = 'parakeet-mediapipe-models-v1';

/**
 * Fetch a model URL, using the Cache Storage API when available.
 *
 * On cache hit: returns the cached bytes immediately.
 * On cache miss: fetches the URL, stores the response, returns the bytes.
 *
 * Safe to call in environments without `caches` (older browsers, SSR) —
 * falls back to a plain fetch in that case, so you always get bytes.
 */
export async function fetchCachedModel(url: string): Promise<Uint8Array> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(url);
      if (hit) {
        const buf = await hit.arrayBuffer();
        return new Uint8Array(buf);
      }
      const fetched = await fetch(url);
      if (!fetched.ok) {
        throw new Error(
          `Model fetch failed: ${fetched.status} ${fetched.statusText}`
        );
      }
      // Cache a clone before consuming the body — Response streams are
      // single-use, so `put` must get its own copy.
      await cache.put(url, fetched.clone());
      const buf = await fetched.arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      // Cache quota / opaque response issues fall through to plain fetch.
    }
  }

  const fetched = await fetch(url);
  if (!fetched.ok) {
    throw new Error(
      `Model fetch failed: ${fetched.status} ${fetched.statusText}`
    );
  }
  const buf = await fetched.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Clear all cached models. Exposed for a potential "force redownload"
 * dashboard button — not wired today but available if a model file
 * changes upstream and the cached copy needs to be invalidated.
 */
export async function clearModelCache(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  return caches.delete(CACHE_NAME);
}
