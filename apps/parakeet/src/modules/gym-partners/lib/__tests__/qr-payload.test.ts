import { describe, expect, it } from 'vitest';

import { decodeQrPayload, encodeQrPayload } from '../qr-payload';

describe('QR payload', () => {
  it('round-trips encode/decode', () => {
    const token = 'abc-123-def';
    const encoded = encodeQrPayload({ token });
    const decoded = decodeQrPayload({ raw: encoded });
    expect(decoded).toEqual({ token });
  });

  it('includes version in encoded payload', () => {
    const encoded = encodeQrPayload({ token: 'test' });
    const parsed = JSON.parse(encoded);
    expect(parsed.version).toBe(1);
    expect(parsed.token).toBe('test');
  });

  it('returns null for invalid JSON', () => {
    expect(decodeQrPayload({ raw: 'not json' })).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(decodeQrPayload({ raw: '"string"' })).toBeNull();
    expect(decodeQrPayload({ raw: '42' })).toBeNull();
    expect(decodeQrPayload({ raw: 'null' })).toBeNull();
  });

  it('returns null when token field is missing', () => {
    expect(decodeQrPayload({ raw: '{"version":1}' })).toBeNull();
  });

  it('returns null when token is not a string', () => {
    expect(decodeQrPayload({ raw: '{"token":42}' })).toBeNull();
  });

  it('ignores extra fields (forward compatible)', () => {
    const raw = JSON.stringify({ token: 'abc', version: 2, extra: true });
    const decoded = decodeQrPayload({ raw });
    expect(decoded).toEqual({ token: 'abc' });
  });
});
