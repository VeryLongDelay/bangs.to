import { describe, expect, test } from 'bun:test';
import {
  type BangUsageEntry,
  buildSuggestFrecency,
  buildTopFrecency,
  createUpdatedBangUsageEntry,
  deserializeFrecencySnapshot,
  getWeeklyUsageBucketIndex,
  incrementWeeklyUsageBucket,
  normalizeTrackedQuery,
  serializeFrecencySnapshot,
  serializeTopFrecency,
  type TopFrecencyEntry,
  updateTopFrecencyOnIncrement
} from '../src/sw/frecency';

function entry(
  score: number,
  count: number,
  lastUsedAt: number,
  queries: BangUsageEntry['queries'] = {}
): BangUsageEntry {
  return { score, count, lastUsedAt, queries };
}

describe('frecency top-k helpers', () => {
  test('buildTopFrecency sorts by score desc then count desc and caps limit', () => {
    const top = buildTopFrecency(
      {
        yt: entry(500, 5, 200),
        g: entry(900, 7, 400, { cats: { count: 3, lastUsedAt: 400 } }),
        ddg: entry(900, 7, 300),
        npm: entry(300, 3, 100),
        z: entry(100, 1, 50)
      },
      4
    );
    expect(top).toEqual([
      { trigger: 'g', score: 900, count: 7, lastUsedAt: 400, queries: ['g cats'] },
      { trigger: 'ddg', score: 900, count: 7, lastUsedAt: 300, queries: [] },
      { trigger: 'yt', score: 500, count: 5, lastUsedAt: 200, queries: [] },
      { trigger: 'npm', score: 300, count: 3, lastUsedAt: 100, queries: [] }
    ]);
  });

  test('updateTopFrecencyOnIncrement inserts and reorders incrementally', () => {
    const top: TopFrecencyEntry[] = [];

    updateTopFrecencyOnIncrement(top, 'yt', entry(100, 1, 10), 3);
    updateTopFrecencyOnIncrement(top, 'g', entry(100, 1, 20), 3);
    updateTopFrecencyOnIncrement(top, 'g', entry(200, 2, 30), 3);
    updateTopFrecencyOnIncrement(top, 'ddg', entry(200, 2, 25), 3);
    updateTopFrecencyOnIncrement(top, 'npm', entry(110, 1, 40), 3);

    expect(top).toEqual([
      { trigger: 'g', score: 200, count: 2, lastUsedAt: 30, queries: [] },
      { trigger: 'ddg', score: 200, count: 2, lastUsedAt: 25, queries: [] },
      { trigger: 'npm', score: 110, count: 1, lastUsedAt: 40, queries: [] }
    ]);
  });

  test('serializeTopFrecency formats score cookie value', () => {
    expect(
      serializeTopFrecency([
        { trigger: 'g', score: 900, count: 9, lastUsedAt: 1, queries: ['g cats'] },
        { trigger: 'yt', score: 300, count: 3, lastUsedAt: 2, queries: [] }
      ])
    ).toBe('g:900.yt:300');
    expect(serializeTopFrecency([])).toBe('');
  });

  test('incremental top-k matches baseline full sort for randomized updates', () => {
    const triggers = ['g', 'yt', 'ddg', 'gh', 'npm', 'w', 'mdn', 'so', 'x'];
    const entries: Record<string, BangUsageEntry> = {};
    const top = buildTopFrecency(entries, 8);

    let seed = 42;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed;
    };

    for (let i = 0; i < 5000; i++) {
      const trigger = triggers[nextRand() % triggers.length];
      const nextEntry = createUpdatedBangUsageEntry(entries[trigger], '', i + 1);
      entries[trigger] = nextEntry;
      updateTopFrecencyOnIncrement(top, trigger, nextEntry, 8);

      const incremental = serializeTopFrecency(top);
      const baseline = serializeTopFrecency(buildTopFrecency(entries, 8));
      expect(incremental).toBe(baseline);
    }
  });
});

describe('frecency snapshot helpers', () => {
  test('normalizeTrackedQuery trims, lowercases, and caps length', () => {
    expect(normalizeTrackedQuery('  React   Query  ')).toBe('react query');
    expect(normalizeTrackedQuery('')).toBe('');
  });

  test('snapshot serialization round-trips modern entries', () => {
    const raw = serializeFrecencySnapshot({
      entries: {
        g: entry(700, 5, 123, { 'react query': { count: 2, lastUsedAt: 123 } })
      },
      lastDecayTs: 123,
      weeklyBuckets: Object.assign(
        Array.from({ length: 168 }, () => 0),
        { 1: 4 }
      )
    });
    expect(deserializeFrecencySnapshot(raw)).toEqual({
      entries: {
        g: entry(700, 5, 123, { 'react query': { count: 2, lastUsedAt: 123 } })
      },
      lastDecayTs: 123,
      weeklyBuckets: Object.assign(
        Array.from({ length: 168 }, () => 0),
        { 1: 4 }
      )
    });
  });

  test('legacy count snapshots migrate into score-based entries', () => {
    expect(deserializeFrecencySnapshot(JSON.stringify({ c: { g: 3 }, t: 50 }))).toEqual({
      entries: {
        g: entry(300, 3, 50)
      },
      lastDecayTs: 50,
      weeklyBuckets: Array.from({ length: 168 }, () => 0)
    });
  });

  test('buildSuggestFrecency keeps query samples for ranking', () => {
    const context = buildSuggestFrecency([
      { trigger: 'gh', score: 400, count: 4, lastUsedAt: 100, queries: ['gh react', 'gh issue'] }
    ]);
    expect(context).toEqual({
      gh: {
        score: 400,
        count: 4,
        lastUsedAt: 100,
        queries: ['gh react', 'gh issue']
      }
    });
  });

  test('incrementWeeklyUsageBucket records the correct local weekday-hour slot', () => {
    const timestamp = new Date(2024, 4, 6, 15, 0, 0, 0).getTime();
    const next = incrementWeeklyUsageBucket([], timestamp);
    expect(next).toHaveLength(168);
    expect(next[getWeeklyUsageBucketIndex(timestamp)]).toBe(1);
  });
});
