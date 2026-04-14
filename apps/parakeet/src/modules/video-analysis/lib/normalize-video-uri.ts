/**
 * Vision-camera returns raw absolute paths on Android (no file:// scheme).
 * The new expo-file-system File() constructor requires a URI scheme and
 * throws "Invalid source URI" for bare paths. Normalize once at the boundary
 * so downstream code (uploads, players, DB) always sees a real URI.
 */
export function normalizeVideoUri(pathOrUri: string): string {
  if (
    pathOrUri.startsWith('file://') ||
    pathOrUri.startsWith('content://') ||
    pathOrUri.startsWith('http://') ||
    pathOrUri.startsWith('https://')
  ) {
    return pathOrUri;
  }
  if (pathOrUri.startsWith('/')) {
    return `file://${pathOrUri}`;
  }
  return pathOrUri;
}
