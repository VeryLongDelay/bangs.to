export interface QueryUsageEntry {
  count: number;
  lastUsedAt: number;
}

export interface BangUsageEntry {
  count: number;
  lastUsedAt: number;
  queries: Record<string, QueryUsageEntry>;
  score: number;
}

export type WeeklyUsageBuckets = number[];

export interface FrecencySnapshot {
  entries: Record<string, BangUsageEntry>;
  lastDecayTs: number;
  weeklyBuckets: WeeklyUsageBuckets;
}

export interface SuggestFrecencyEntry {
  count: number;
  lastUsedAt: number;
  queries: string[];
  score: number;
}

export type SuggestFrecency = Record<string, SuggestFrecencyEntry>;

export interface TopFrecencyEntry {
  count: number;
  lastUsedAt: number;
  queries: string[];
  score: number;
  trigger: string;
}

const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const WEEKLY_BUCKET_COUNT = DAYS_PER_WEEK * HOURS_PER_DAY;
const EMPTY_SNAPSHOT: FrecencySnapshot = { entries: {}, lastDecayTs: 0, weeklyBuckets: [] };
const MAX_QUERY_SAMPLES_PER_BANG = 6;
const QUERY_SAMPLE_LIMIT = 3;
const QUERY_TEXT_MAX_LENGTH = 56;
const SCORE_PER_USE = 100;

function normalizePositiveInteger(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return 0;
}

function normalizeQueryMap(value: unknown): Record<string, QueryUsageEntry> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const queries: Record<string, QueryUsageEntry> = {};
  for (const [query, rawEntry] of Object.entries(value)) {
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      continue;
    }
    const count = normalizePositiveInteger((rawEntry as QueryUsageEntry).count);
    const lastUsedAt = normalizePositiveInteger((rawEntry as QueryUsageEntry).lastUsedAt);
    if (!count) {
      continue;
    }
    queries[query] = {
      count,
      lastUsedAt
    };
  }
  return queries;
}

function normalizeBangUsageEntry(value: unknown): BangUsageEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const count = normalizePositiveInteger((value as BangUsageEntry).count);
  const score = normalizePositiveInteger((value as BangUsageEntry).score);
  const lastUsedAt = normalizePositiveInteger((value as BangUsageEntry).lastUsedAt);
  const queries = normalizeQueryMap((value as BangUsageEntry).queries);

  if (!(count || score)) {
    return null;
  }

  return {
    count,
    lastUsedAt,
    queries,
    score: score || count * SCORE_PER_USE
  };
}

function createEmptyWeeklyUsageBuckets(): WeeklyUsageBuckets {
  return Array.from({ length: WEEKLY_BUCKET_COUNT }, () => 0);
}

function normalizeWeeklyUsageBuckets(value: unknown): WeeklyUsageBuckets {
  const buckets = createEmptyWeeklyUsageBuckets();
  if (!Array.isArray(value)) {
    return buckets;
  }

  for (let i = 0; i < WEEKLY_BUCKET_COUNT; i++) {
    buckets[i] = normalizePositiveInteger(value[i]);
  }
  return buckets;
}

function sortQueries(queries: Record<string, QueryUsageEntry>): string[] {
  return Object.entries(queries)
    .sort(
      (a, b) =>
        b[1].count - a[1].count || b[1].lastUsedAt - a[1].lastUsedAt || a[0].localeCompare(b[0])
    )
    .map(([query]) => query);
}

function topQuerySamples(
  trigger: string,
  queries: Record<string, QueryUsageEntry>,
  limit = QUERY_SAMPLE_LIMIT
): string[] {
  const sorted = sortQueries(queries);
  if (sorted.length > limit) {
    sorted.length = limit;
  }
  return sorted.map(query => (query ? `${trigger} ${query}` : trigger));
}

function isBetter(candidate: TopFrecencyEntry, other: TopFrecencyEntry): boolean {
  return (
    candidate.score > other.score ||
    (candidate.score === other.score && candidate.count > other.count) ||
    (candidate.score === other.score &&
      candidate.count === other.count &&
      candidate.lastUsedAt > other.lastUsedAt) ||
    (candidate.score === other.score &&
      candidate.count === other.count &&
      candidate.lastUsedAt === other.lastUsedAt &&
      candidate.trigger < other.trigger)
  );
}

export function normalizeTrackedQuery(query: string): string {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) {
    return '';
  }
  return normalized.length > QUERY_TEXT_MAX_LENGTH
    ? normalized.substring(0, QUERY_TEXT_MAX_LENGTH).trimEnd()
    : normalized;
}

export function deserializeFrecencySnapshot(value: string | null | undefined): FrecencySnapshot {
  if (!value) {
    return {
      ...EMPTY_SNAPSHOT,
      weeklyBuckets: createEmptyWeeklyUsageBuckets()
    };
  }

  try {
    const parsed = JSON.parse(value) as
      | { b?: Record<string, unknown>; c?: Record<string, number>; t?: number; w?: unknown }
      | Record<string, number>;

    const lastDecayTs = normalizePositiveInteger((parsed as { t?: number }).t) || Date.now();
    const weeklyBuckets = normalizeWeeklyUsageBuckets((parsed as { w?: unknown }).w);
    const modernEntries = (parsed as { b?: Record<string, unknown> }).b;
    if (modernEntries && typeof modernEntries === 'object' && !Array.isArray(modernEntries)) {
      const entries: Record<string, BangUsageEntry> = {};
      for (const [trigger, rawEntry] of Object.entries(modernEntries)) {
        const entry = normalizeBangUsageEntry(rawEntry);
        if (entry) {
          entries[trigger] = entry;
        }
      }
      return { entries, lastDecayTs, weeklyBuckets };
    }

    const legacyCounts = (parsed as { c?: Record<string, number> }).c ?? parsed;
    if (legacyCounts && typeof legacyCounts === 'object' && !Array.isArray(legacyCounts)) {
      const entries: Record<string, BangUsageEntry> = {};
      for (const [trigger, rawCount] of Object.entries(legacyCounts)) {
        const count = normalizePositiveInteger(rawCount);
        if (!count) {
          continue;
        }
        entries[trigger] = {
          count,
          lastUsedAt: lastDecayTs,
          queries: {},
          score: count * SCORE_PER_USE
        };
      }
      return { entries, lastDecayTs, weeklyBuckets };
    }
  } catch {
    return {
      ...EMPTY_SNAPSHOT,
      weeklyBuckets: createEmptyWeeklyUsageBuckets()
    };
  }

  return {
    ...EMPTY_SNAPSHOT,
    weeklyBuckets: createEmptyWeeklyUsageBuckets()
  };
}

export function serializeFrecencySnapshot(snapshot: FrecencySnapshot): string {
  return JSON.stringify({
    b: snapshot.entries,
    t: snapshot.lastDecayTs,
    w: normalizeWeeklyUsageBuckets(snapshot.weeklyBuckets)
  });
}

export function getWeeklyUsageBucketIndex(timestamp: number): number {
  const date = new Date(timestamp);
  return date.getDay() * HOURS_PER_DAY + date.getHours();
}

export function incrementWeeklyUsageBucket(
  weeklyBuckets: WeeklyUsageBuckets,
  timestamp: number
): WeeklyUsageBuckets {
  const next =
    weeklyBuckets.length === WEEKLY_BUCKET_COUNT
      ? [...weeklyBuckets]
      : normalizeWeeklyUsageBuckets(weeklyBuckets);
  const index = getWeeklyUsageBucketIndex(timestamp);
  next[index] = (next[index] ?? 0) + 1;
  return next;
}

export function buildTopFrecency(
  entries: Record<string, BangUsageEntry>,
  limit: number
): TopFrecencyEntry[] {
  if (limit <= 0) {
    return [];
  }

  const top = Object.entries(entries)
    .filter(([, entry]) => entry.score > 0 || entry.count > 0)
    .map(([trigger, entry]) => ({
      trigger,
      count: entry.count,
      lastUsedAt: entry.lastUsedAt,
      queries: topQuerySamples(trigger, entry.queries),
      score: entry.score
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.count - a.count ||
        b.lastUsedAt - a.lastUsedAt ||
        a.trigger.localeCompare(b.trigger)
    );

  if (top.length > limit) {
    top.length = limit;
  }
  return top;
}

export function updateTopFrecencyOnIncrement(
  top: TopFrecencyEntry[],
  trigger: string,
  entry: BangUsageEntry,
  limit: number
): void {
  if (limit <= 0 || !(entry.score > 0 || entry.count > 0)) {
    return;
  }

  let idx = -1;
  for (let i = 0; i < top.length; i++) {
    if (top[i].trigger === trigger) {
      idx = i;
      break;
    }
  }

  const next: TopFrecencyEntry = {
    trigger,
    count: entry.count,
    lastUsedAt: entry.lastUsedAt,
    queries: topQuerySamples(trigger, entry.queries),
    score: entry.score
  };

  if (idx === -1) {
    if (top.length < limit) {
      top.push(next);
      idx = top.length - 1;
    } else if (isBetter(next, top[top.length - 1])) {
      top[top.length - 1] = next;
      idx = top.length - 1;
    } else {
      return;
    }
  } else {
    top[idx] = next;
  }

  while (idx > 0 && isBetter(top[idx], top[idx - 1])) {
    const prev = top[idx - 1];
    top[idx - 1] = top[idx];
    top[idx] = prev;
    idx--;
  }
}

export function serializeTopFrecency(top: readonly TopFrecencyEntry[]): string {
  if (top.length === 0) {
    return '';
  }
  let out = `${top[0].trigger}:${top[0].score}`;
  for (let i = 1; i < top.length; i++) {
    out += `.${top[i].trigger}:${top[i].score}`;
  }
  return out;
}

export function buildSuggestFrecency(top: readonly TopFrecencyEntry[]): SuggestFrecency {
  const frecency: SuggestFrecency = {};
  for (const entry of top) {
    frecency[entry.trigger] = {
      count: entry.count,
      lastUsedAt: entry.lastUsedAt,
      queries: entry.queries,
      score: entry.score
    };
  }
  return frecency;
}

function pruneQueries(queries: Record<string, QueryUsageEntry>): Record<string, QueryUsageEntry> {
  const sorted = sortQueries(queries);
  if (sorted.length <= MAX_QUERY_SAMPLES_PER_BANG) {
    return queries;
  }

  const next: Record<string, QueryUsageEntry> = {};
  for (let i = 0; i < MAX_QUERY_SAMPLES_PER_BANG; i++) {
    const query = sorted[i];
    next[query] = queries[query];
  }
  return next;
}

export function createUpdatedBangUsageEntry(
  previous: BangUsageEntry | undefined,
  trackedQuery: string,
  now: number
): BangUsageEntry {
  const queries = { ...(previous?.queries ?? {}) };
  if (trackedQuery) {
    const nextQuery = queries[trackedQuery];
    queries[trackedQuery] = {
      count: (nextQuery?.count ?? 0) + 1,
      lastUsedAt: now
    };
  }

  return {
    count: (previous?.count ?? 0) + 1,
    lastUsedAt: now,
    queries: pruneQueries(queries),
    score: Math.round((previous?.score ?? 0) + SCORE_PER_USE)
  };
}
