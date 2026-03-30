const QR_VERSION = 1;

export function encodeQrPayload({ token }: { token: string }) {
  return JSON.stringify({ token, version: QR_VERSION });
}

export function decodeQrPayload({ raw }: { raw: string }) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof parsed.token !== 'string') return null;
    return { token: parsed.token as string };
  } catch {
    return null;
  }
}
