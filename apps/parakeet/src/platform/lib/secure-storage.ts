import * as SecureStore from 'expo-secure-store';

/**
 * Supabase-compatible storage adapter backed by expo-secure-store.
 * Uses the platform keychain (iOS) / keystore (Android) for auth tokens.
 */
export const secureStorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value).then(() => undefined),
  removeItem: (key: string) =>
    SecureStore.deleteItemAsync(key).then(() => undefined),
};
