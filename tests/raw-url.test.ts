import { describe, expect, test } from 'vitest';
import { readOrigin, readPathname } from '../src/shared/raw-url';

describe('readPathname', () => {
  test('parses pathname from absolute URL with query and hash', () => {
    expect(readPathname('https://bangs.local/suggest?q=cats&sp=none#frag')).toBe('/suggest');
  });

  test('returns / for origin-only absolute URL', () => {
    expect(readPathname('https://bangs.local')).toBe('/');
    expect(readPathname('https://bangs.local?q=1')).toBe('/');
  });

  test('parses pathname from path-only URL', () => {
    expect(readPathname('/home?x=1')).toBe('/home');
    expect(readPathname('/')).toBe('/');
  });

  test('returns / for invalid relative URL without leading slash', () => {
    expect(readPathname('suggest?q=cats')).toBe('/');
  });

  test('treats empty pathname as /', () => {
    expect(readPathname('https://bangs.local#top')).toBe('/');
  });
});

describe('readOrigin', () => {
  test('returns origin for absolute URLs with and without paths', () => {
    expect(readOrigin('https://bangs.local/suggest?q=1')).toBe('https://bangs.local');
    expect(readOrigin('https://bangs.local')).toBe('https://bangs.local');
    expect(readOrigin('http://localhost:3000/path')).toBe('http://localhost:3000');
  });

  test('returns empty string for path-only URLs', () => {
    expect(readOrigin('/suggest?q=1')).toBe('');
  });
});
