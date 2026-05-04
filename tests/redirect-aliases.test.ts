import { describe, expect, test } from 'bun:test';
import { getStaticRedirect } from '../src/server/redirects';

describe('static route aliases', () => {
  test('history aliases to stats', () => {
    expect(getStaticRedirect('/history')).toBe('/stats');
    expect(getStaticRedirect('/history.html')).toBe('/stats');
  });

  test('other paths do not redirect', () => {
    expect(getStaticRedirect('/stats')).toBeNull();
    expect(getStaticRedirect('/faq')).toBeNull();
  });
});
