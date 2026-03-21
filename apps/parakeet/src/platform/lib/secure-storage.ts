import * as SecureStore from 'expo-secure-store';

/**
 * SecureStore has a 2048-byte limit per key. Supabase auth sessions
 * routinely exceed this (JWT + refresh token). We chunk large values
 * into numbered keys and store the chunk count in a sentinel key.
 */
const CHUNK_SIZE = 2048;

function chunkKey(key: string, index: number) {
  return `${key}__chunk_${index}`;
}

async function getChunked(key: string): Promise<string | null> {
  const sentinel = await SecureStore.getItemAsync(key);
  if (sentinel === null) return null;

  // If the sentinel doesn't start with our marker, it's a legacy unchunked value
  if (!sentinel.startsWith('__chunked:')) return sentinel;

  const count = parseInt(sentinel.replace('__chunked:', ''), 10);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = await SecureStore.getItemAsync(chunkKey(key, i));
    if (chunk === null) return null; // corrupted — treat as missing
    parts.push(chunk);
  }
  return parts.join('');
}

async function setChunked(key: string, value: string): Promise<void> {
  if (value.length <= CHUNK_SIZE) {
    // Small value — store directly, clean up any old chunks
    await removeChunked(key);
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }

  // Write chunks first, then the sentinel (so reads never see a partial state)
  for (let i = 0; i < chunks.length; i++) {
    await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]);
  }
  await SecureStore.setItemAsync(key, `__chunked:${chunks.length}`);
}

async function removeChunked(key: string): Promise<void> {
  const sentinel = await SecureStore.getItemAsync(key);
  if (sentinel?.startsWith('__chunked:')) {
    const count = parseInt(sentinel.replace('__chunked:', ''), 10);
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
  }
  await SecureStore.deleteItemAsync(key);
}

/**
 * Supabase-compatible storage adapter backed by expo-secure-store.
 * Uses the platform keychain (iOS) / keystore (Android) for auth tokens.
 * Automatically chunks values exceeding SecureStore's 2048-byte limit.
 */
export const secureStorageAdapter = {
  getItem: (key: string) => getChunked(key),
  setItem: (key: string, value: string) =>
    setChunked(key, value).then(() => undefined),
  removeItem: (key: string) =>
    removeChunked(key).then(() => undefined),
};
