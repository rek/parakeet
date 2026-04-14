import { describe, expect, it } from 'vitest';

import { normalizeVideoUri } from '../normalize-video-uri';

describe('normalizeVideoUri', () => {
  it('prepends file:// to bare absolute paths', () => {
    expect(normalizeVideoUri('/storage/emulated/0/video.mp4')).toBe(
      'file:///storage/emulated/0/video.mp4'
    );
  });

  it('passes file:// URIs through unchanged', () => {
    expect(normalizeVideoUri('file:///var/mobile/video.mov')).toBe(
      'file:///var/mobile/video.mov'
    );
  });

  it('passes content:// URIs through unchanged', () => {
    expect(normalizeVideoUri('content://media/external/video/123')).toBe(
      'content://media/external/video/123'
    );
  });

  it('passes https URIs through unchanged', () => {
    expect(normalizeVideoUri('https://example.com/video.mp4')).toBe(
      'https://example.com/video.mp4'
    );
  });

  it('leaves non-path strings alone', () => {
    expect(normalizeVideoUri('relative/path.mp4')).toBe('relative/path.mp4');
  });
});
