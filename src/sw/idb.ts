import { lookupBang } from '../generated/bangs-min.js';
import {
  DEFAULT_LUCKY_URL,
  DEFAULT_URL,
  FRECENCY_HALF_LIFE_MS,
  LUCKY_URLS,
  MAX_FRECENCY_ENTRIES
} from '../shared/constants';
import { idbWrap, openDB, resetDB } from '../shared/idb';
import {
  buildSuggestFrecency,
  buildTopFrecency,
  createUpdatedBangUsageEntry,
  deserializeFrecencySnapshot,
  type FrecencySnapshot,
  incrementWeeklyUsageBucket,
  normalizeTrackedQuery,
  type SuggestFrecency,
  serializeFrecencySnapshot,
  serializeTopFrecency,
  type TopFrecencyEntry,
  updateTopFrecencyOnIncrement
} from './frecency';
import type { RedirectSettings, UrlParts } from './redirect';

function splitUrl(url: string): UrlParts {
  const idx = url.indexOf('{}');
  return idx === -1 ? [url, null] : [url.substring(0, idx), url.substring(idx + 2)];
}

const FRECENCY_COOKIE_ENTRIES = 8;

let persistInFlight = false;
let cachedRedirect: RedirectSettings | null = null;
let redirectSettingsPromise: Promise<RedirectSettings> | null = null;
let frecencyEntries: FrecencySnapshot['entries'] | null = null;
let loadFrecencyPromise: Promise<void> | null = null;
let frecencyCookie: string = '';
let suggestFrecency: SuggestFrecency = {};
let topFrecency: TopFrecencyEntry[] = [];
let lastDecayTs: number = 0;
let weeklyBuckets: FrecencySnapshot['weeklyBuckets'] = [];

export function getCachedSettings(): RedirectSettings | null {
  return cachedRedirect;
}

export function readRedirectSettings(): Promise<RedirectSettings> {
  if (cachedRedirect) {
    return Promise.resolve(cachedRedirect);
  }

  if (!redirectSettingsPromise) {
    redirectSettingsPromise = (async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(['settings', 'custom-bangs'], 'readonly');
        const [settings, all] = await Promise.all([
          idbWrap<Array<{ key: string; value?: string }>>(tx.objectStore('settings').getAll()),
          idbWrap<Array<{ trigger: string; url: string }>>(tx.objectStore('custom-bangs').getAll())
        ]);
        const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
        const defaultBang = settingsMap['default-bang'] || 'ddg';
        const tpl = lookupBang(defaultBang);
        const defaultUrl: UrlParts = tpl || splitUrl(DEFAULT_URL);
        const luckyProvider = settingsMap['lucky-provider'] ?? 'default';
        let luckyUrl: UrlParts | null;
        switch (luckyProvider) {
          case 'none':
            luckyUrl = null;
            break;
          case 'google':
            luckyUrl = splitUrl(LUCKY_URLS.g);
            break;
          case 'ddg':
            luckyUrl = splitUrl(LUCKY_URLS.ddg);
            break;
          case 'kagi':
            luckyUrl = splitUrl(LUCKY_URLS.kagi);
            break;
          case 'custom':
            luckyUrl = settingsMap['lucky-url'] ? splitUrl(settingsMap['lucky-url']) : null;
            break;
          default:
            luckyUrl = splitUrl(LUCKY_URLS[defaultBang] || DEFAULT_LUCKY_URL);
            break;
        }

        const custom: Record<string, UrlParts> = Object.create(null);
        for (const e of all) {
          custom[e.trigger] = splitUrl(e.url);
        }

        cachedRedirect = { defaultUrl, custom, luckyUrl };
      } catch {
        cachedRedirect = {
          defaultUrl: splitUrl(DEFAULT_URL),
          custom: Object.create(null),
          luckyUrl: splitUrl(DEFAULT_LUCKY_URL)
        };
      }

      return cachedRedirect as RedirectSettings;
    })().finally(() => {
      redirectSettingsPromise = null;
    });
  }

  return redirectSettingsPromise;
}

function persistFrecencySnapshot(entries: FrecencySnapshot['entries'] | null, ts: number): void {
  if (persistInFlight) {
    return;
  }
  persistInFlight = true;
  const value = serializeFrecencySnapshot({
    entries: entries ?? {},
    lastDecayTs: ts,
    weeklyBuckets
  });
  openDB()
    .then(db => {
      persistInFlight = false;
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      store.put({ key: 'frecency', value });
    })
    .catch(() => {
      persistInFlight = false;
    });
}

export function invalidateCache() {
  if (frecencyEntries) {
    persistFrecencySnapshot(frecencyEntries, lastDecayTs);
  }
  persistInFlight = false;
  cachedRedirect = null;
  redirectSettingsPromise = null;
  resetDB();
  resetFrecencyCache();
}

export function resetFrecencyCache() {
  loadFrecencyPromise = null;
  frecencyEntries = null;
  topFrecency = [];
  frecencyCookie = '';
  suggestFrecency = {};
  lastDecayTs = 0;
  weeklyBuckets = [];
}

function rebuildFrecencyTopAndValue(): void {
  const entries = frecencyEntries;
  if (!entries) {
    topFrecency = [];
    frecencyCookie = '';
    suggestFrecency = {};
    return;
  }
  topFrecency = buildTopFrecency(entries, FRECENCY_COOKIE_ENTRIES);
  frecencyCookie = serializeTopFrecency(topFrecency);
  suggestFrecency = buildSuggestFrecency(topFrecency);
}

function applyDecay(): void {
  if (!(frecencyEntries && lastDecayTs)) {
    lastDecayTs = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = now - lastDecayTs;
  if (elapsed < 3_600_000) {
    return;
  }
  const factor = 0.5 ** (elapsed / FRECENCY_HALF_LIFE_MS);
  const pruned: FrecencySnapshot['entries'] = {};
  for (const [trigger, entry] of Object.entries(frecencyEntries)) {
    const score = Math.round(entry.score * factor);
    if (score >= 1) {
      pruned[trigger] = {
        ...entry,
        score
      };
    }
  }
  frecencyEntries = pruned;
  lastDecayTs = now;
}

function pruneFrecency(): void {
  if (!frecencyEntries) {
    return;
  }
  const keys = Object.keys(frecencyEntries);
  if (keys.length <= MAX_FRECENCY_ENTRIES) {
    return;
  }
  const entries = Object.entries(frecencyEntries);
  entries.sort(
    (a, b) =>
      b[1].score - a[1].score ||
      b[1].count - a[1].count ||
      b[1].lastUsedAt - a[1].lastUsedAt ||
      a[0].localeCompare(b[0])
  );
  frecencyEntries = Object.fromEntries(entries.slice(0, MAX_FRECENCY_ENTRIES));
}

export function getFrecencyValue(): string {
  return frecencyCookie;
}

export function getSuggestFrecencyValue(): SuggestFrecency {
  return suggestFrecency;
}

export function getFrecencySnapshot(): FrecencySnapshot {
  return {
    entries: frecencyEntries ?? {},
    lastDecayTs,
    weeklyBuckets
  };
}

export function loadFrecency(): Promise<void> {
  if (frecencyEntries) {
    return Promise.resolve();
  }

  if (!loadFrecencyPromise) {
    loadFrecencyPromise = (async () => {
      try {
        const db = await openDB();
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const result = await idbWrap<{ value?: string } | undefined>(store.get('frecency'));
        const snapshot = deserializeFrecencySnapshot(result?.value ?? null);
        frecencyEntries = snapshot.entries;
        lastDecayTs = snapshot.lastDecayTs || Date.now();
        weeklyBuckets = snapshot.weeklyBuckets;

        applyDecay();
        pruneFrecency();
        rebuildFrecencyTopAndValue();
        persistFrecencySnapshot(frecencyEntries, lastDecayTs);
      } catch {
        frecencyEntries = {};
        topFrecency = [];
        frecencyCookie = '';
        suggestFrecency = {};
        lastDecayTs = Date.now();
        weeklyBuckets = [];
      }
    })().finally(() => {
      loadFrecencyPromise = null;
    });
  }

  return loadFrecencyPromise;
}

export function trackBangUsage(trigger: string, trackedQuery = '') {
  if (!frecencyEntries) {
    frecencyEntries = {};
    topFrecency = [];
  }
  applyDecay();
  const now = Date.now();
  const nextEntry = createUpdatedBangUsageEntry(
    frecencyEntries[trigger],
    normalizeTrackedQuery(trackedQuery),
    now
  );
  frecencyEntries[trigger] = nextEntry;
  weeklyBuckets = incrementWeeklyUsageBucket(weeklyBuckets, now);
  updateTopFrecencyOnIncrement(topFrecency, trigger, nextEntry, FRECENCY_COOKIE_ENTRIES);
  frecencyCookie = serializeTopFrecency(topFrecency);
  suggestFrecency = buildSuggestFrecency(topFrecency);
  persistFrecencySnapshot(frecencyEntries, lastDecayTs || now);
}
