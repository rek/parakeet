import { describe, expect, it } from 'vitest';

import { extractSources } from '../extract-sources';

describe('extractSources', () => {
  it('returns [] for null / undefined / empty input', () => {
    expect(extractSources(null)).toEqual([]);
    expect(extractSources(undefined)).toEqual([]);
    expect(extractSources('')).toEqual([]);
  });

  it('returns [] when ## Sources heading is absent', () => {
    const md = '# Keto\n\nSome prose.\n\n## Macros\n\n- fat\n- protein';
    expect(extractSources(md)).toEqual([]);
  });

  it('extracts markdown links under ## Sources', () => {
    const md = [
      '# Title',
      '',
      '## Sources',
      '',
      '- Paper A. [First link](https://example.com/a)',
      '- Paper B. [Second link](https://example.com/b)',
      '',
    ].join('\n');
    expect(extractSources(md)).toEqual([
      { title: 'First link', url: 'https://example.com/a' },
      { title: 'Second link', url: 'https://example.com/b' },
    ]);
  });

  it('matches the heading case-insensitively', () => {
    const md = '## SOURCES\n\n[x](https://example.com/x)';
    expect(extractSources(md)).toEqual([
      { title: 'x', url: 'https://example.com/x' },
    ]);
  });

  it('ignores links before the Sources heading', () => {
    const md = [
      'Intro with [ignored link](https://ignored.test/a)',
      '## Sources',
      '[included](https://included.test/b)',
    ].join('\n');
    expect(extractSources(md)).toEqual([
      { title: 'included', url: 'https://included.test/b' },
    ]);
  });

  it('stops at the next h1 / h2 heading', () => {
    const md = [
      '## Sources',
      '[first](https://keep.test/a)',
      '## Appendix',
      '[skip](https://drop.test/b)',
    ].join('\n');
    expect(extractSources(md)).toEqual([
      { title: 'first', url: 'https://keep.test/a' },
    ]);
  });

  it('continues past h3+ sub-headings inside the Sources section', () => {
    const md = [
      '## Sources',
      '### Papers',
      '[p1](https://keep.test/p1)',
      '### Books',
      '[b1](https://keep.test/b1)',
    ].join('\n');
    expect(extractSources(md)).toEqual([
      { title: 'p1', url: 'https://keep.test/p1' },
      { title: 'b1', url: 'https://keep.test/b1' },
    ]);
  });

  it('dedupes repeated URLs (keeps first title)', () => {
    const md = [
      '## Sources',
      '[First title](https://dup.test/x)',
      '[Second title](https://dup.test/x)',
      '[Other](https://other.test/y)',
    ].join('\n');
    expect(extractSources(md)).toEqual([
      { title: 'First title', url: 'https://dup.test/x' },
      { title: 'Other', url: 'https://other.test/y' },
    ]);
  });

  it('only accepts http(s) URLs', () => {
    const md = [
      '## Sources',
      '[ftp link](ftp://example.com/a)',
      '[local](file:///tmp/x)',
      '[ok](https://example.com/ok)',
    ].join('\n');
    expect(extractSources(md)).toEqual([
      { title: 'ok', url: 'https://example.com/ok' },
    ]);
  });

  it('handles windows line endings', () => {
    const md = '## Sources\r\n[a](https://example.com/a)\r\n';
    expect(extractSources(md)).toEqual([
      { title: 'a', url: 'https://example.com/a' },
    ]);
  });

  it('trims link title whitespace', () => {
    const md = '## Sources\n[  spaced  ](https://example.com/a)';
    expect(extractSources(md)).toEqual([
      { title: 'spaced', url: 'https://example.com/a' },
    ]);
  });
});
