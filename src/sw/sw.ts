declare const self: ServiceWorkerGlobalScope;

import { COOKIE_MAX_AGE_S } from '../shared/constants';
import { encodeSuggestCookieValue, parseSuggestCookieValue } from '../shared/suggest-cookie';
import {
  getCachedSettings,
  getFrecencyValue,
  getSuggestFrecencyValue,
  invalidateCache,
  loadFrecency,
  readRedirectSettings,
  resetFrecencyCache,
  trackBangUsage
} from './idb';
import { type RedirectSettings, redirectRaw, redirectUrlAndTrigger } from './redirect';

declare const __CACHE_VERSION__: string;
declare const __EXTRA_ASSETS__: string[];
declare const __IS_DEV__: boolean;

const CACHE_NAME = __CACHE_VERSION__;
const ASSETS = [
  '/home',
  '/app.js',
  '/theme.js',
  '/icon.svg',
  '/manifest.json',
  ...__EXTRA_ASSETS__
];

const CRITICAL_ASSETS: string[] = [];
const OPTIONAL_ASSETS = [...new Set(ASSETS)];
const PRECACHE_CONCURRENCY = 4;
let optionalPrecachePromise: Promise<void> | null = null;
const RESOLVED_PROMISE: Promise<void> = Promise.resolve();
const swallowError = () => {
  /* best-effort */
};

async function precacheAssets(cacheName: string, assetPaths: readonly string[]): Promise<void> {
  if (assetPaths.length === 0) {
    return;
  }
  const cache = await caches.open(cacheName);
  let nextIndex = 0;

  async function work(): Promise<void> {
    while (true) {
      const idx = nextIndex++;
      if (idx >= assetPaths.length) {
        return;
      }
      const assetPath = assetPaths[idx];
      const req = new Request(assetPath);
      const res = await fetch(req);
      if (!res.ok) {
        throw new Error(`Failed to precache ${assetPath}: ${res.status} ${res.statusText}`);
      }
      await cache.put(req, res);
    }
  }

  const workers = Math.min(PRECACHE_CONCURRENCY, assetPaths.length);
  await Promise.all(Array.from({ length: workers }, () => work()));
}

async function deleteOldCaches(cacheName: string): Promise<void> {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== cacheName).map(k => caches.delete(k)));
}

function ensureOptionalPrecache(): Promise<void> {
  if (optionalPrecachePromise) {
    return optionalPrecachePromise;
  }
  optionalPrecachePromise = precacheAssets(CACHE_NAME, OPTIONAL_ASSETS).catch(swallowError);
  return optionalPrecachePromise;
}

function queueBangSideEffects(e: FetchEvent, trigger: string, rawQuery: string): void {
  e.waitUntil(recordBangSideEffects(trigger, rawQuery));
}

function recordBangSideEffects(trigger: string, rawQuery: string): Promise<void> {
  return RESOLVED_PROMISE.then(() => {
    trackBangUsage(trigger, extractBangQuery(rawQuery, trigger));
    const val = getFrecencyValue();
    if (!val || typeof cookieStore === 'undefined') {
      return;
    }

    const frecency = getSuggestFrecencyValue();
    const updateSuggestCookie = cookieStore.get('suggest').then(cookie => {
      if (!cookie?.value) {
        return;
      }
      const parsed = parseSuggestCookieValue(cookie.value, true);
      return cookieStore.set({
        name: 'suggest',
        value: encodeSuggestCookieValue(
          parsed.provider,
          parsed.trigger,
          parsed.customUrl || '',
          parsed.custom,
          frecency
        ),
        path: '/',
        expires: Date.now() + COOKIE_MAX_AGE_S * 1000,
        sameSite: 'lax'
      });
    });

    return Promise.all([
      cookieStore
        .set({
          name: 'sf',
          value: val,
          path: '/',
          expires: Date.now() + COOKIE_MAX_AGE_S * 1000,
          sameSite: 'lax'
        })
        .catch(swallowError),
      updateSuggestCookie
    ])
      .then(() => {
        /* no-op */
      })
      .catch(swallowError);
  }).catch(swallowError);
}

function decodeBangQuery(rawQuery: string): string {
  try {
    return decodeURIComponent(rawQuery.replace(/\+/g, ' ')).trim();
  } catch {
    return rawQuery.replace(/\+/g, ' ').trim();
  }
}

function extractBangQuery(rawQuery: string, trigger: string): string {
  if (!rawQuery) {
    return '';
  }

  const decoded = decodeBangQuery(rawQuery);
  const normalized = decoded.toLowerCase();
  const bang = trigger.toLowerCase();
  const prefix = `!${bang}`;
  const suffix = `${bang}!`;

  if (normalized === prefix || normalized === suffix) {
    return '';
  }
  if (normalized.startsWith(`${prefix} `)) {
    return decoded.substring(prefix.length + 1).trim();
  }
  if (normalized.startsWith(`${suffix} `)) {
    return decoded.substring(suffix.length + 1).trim();
  }
  if (normalized.endsWith(` ${prefix}`)) {
    return decoded.substring(0, decoded.length - prefix.length - 1).trim();
  }
  if (normalized.endsWith(` ${suffix}`)) {
    return decoded.substring(0, decoded.length - suffix.length - 1).trim();
  }

  return '';
}

self.addEventListener('install', (e: ExtendableEvent) => {
  e.waitUntil(
    Promise.all([self.skipWaiting(), precacheAssets(CACHE_NAME, CRITICAL_ASSETS)]).then(() => {
      /* no-op */
    })
  );
});

self.addEventListener('activate', (e: ExtendableEvent) => {
  void readRedirectSettings();
  void loadFrecency();
  e.waitUntil(
    Promise.all([deleteOldCaches(CACHE_NAME), self.clients.claim()]).then(() => {
      /* no-op */
    })
  );
});

self.addEventListener('message', (e: ExtendableMessageEvent) => {
  if (e.data?.type === 'invalidate') {
    invalidateCache();
  }
  if (e.data?.type === 'refresh-frecency') {
    resetFrecencyCache();
    e.waitUntil(loadFrecency());
  }
  if (e.data?.type === 'claim') {
    e.waitUntil(self.clients.claim());
  }
  if (e.data?.type === 'redirect' && e.data.query) {
    const q = e.data.query as string;
    const resolve = (s: RedirectSettings) => {
      const [url, trigger] = redirectUrlAndTrigger(q, s);
      if (trigger) {
        e.waitUntil(recordBangSideEffects(trigger, encodeURIComponent(q).replace(/%5C/g, '\\')));
      }
      (e.source as Client)?.postMessage({
        url
      });
    };
    const cached = getCachedSettings();
    if (cached) {
      resolve(cached);
    } else {
      readRedirectSettings().then(resolve);
    }
  }
});

self.addEventListener('fetch', (e: FetchEvent) => {
  const raw = e.request.url;
  const { pathname } = new URL(raw);
  const isSearchEntrypoint =
    pathname === '/' ||
    pathname === '/index.html' ||
    pathname === '/home' ||
    pathname === '/home.html' ||
    pathname === '/settings';

  if (__IS_DEV__ && raw.includes('/__dev/')) {
    return;
  }

  // Start optional asset warmup once per SW lifecycle, without touching
  // waitUntil on every fetch.
  if (!optionalPrecachePromise) {
    e.waitUntil(ensureOptionalPrecache());
  }

  const qIdx = raw.indexOf('?q=');
  if (isSearchEntrypoint && qIdx !== -1) {
    const vStart = qIdx + 3;
    const vEnd = raw.indexOf('&', vStart);
    const rawQ = vEnd === -1 ? raw.substring(vStart) : raw.substring(vStart, vEnd);
    if (rawQ) {
      const cached = getCachedSettings();
      if (cached) {
        const [resp, trigger] = redirectRaw(rawQ, cached);
        if (trigger) {
          queueBangSideEffects(e, trigger, rawQ);
        }
        e.respondWith(resp);
      } else {
        e.respondWith(
          readRedirectSettings().then(s => {
            const [resp, trigger] = redirectRaw(rawQ, s);
            if (trigger) {
              queueBangSideEffects(e, trigger, rawQ);
            }
            return resp;
          })
        );
      }
      return;
    }
  }

  if (isSearchEntrypoint) {
    e.respondWith(
      caches
        .match(new Request('/home'))
        .then(r => r || fetch('/home').catch(() => new Response('Offline', { status: 503 })))
    );
    return;
  }

  e.respondWith(
    caches
      .match(e.request)
      .then(r => r || fetch(e.request).catch(() => new Response('Offline', { status: 503 })))
      .catch(() => new Response('Offline', { status: 503 }))
  );
});
