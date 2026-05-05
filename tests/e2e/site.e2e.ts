import { expect, type Page, test } from '@playwright/test';
import { encodeSuggestCookieValue } from '../../src/shared/suggest-cookie';
import { deserializeFrecencySnapshot } from '../../src/sw/frecency';

const GOOGLE_REDIRECT = /google\.com\/search\?q=hello/;
const GOOGLE_HOST = 'https://www.google.com';
const CUSTOM_HOST = 'https://example.com';
const DB_NAME = 'bangs-to';

async function mockGoogleSearchRoute(page: Page): Promise<void> {
  await page.route(`${GOOGLE_HOST}/**`, route => {
    const url = route.request().url();
    route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: `mocked ${url}`
    });
  });
}

async function mockCustomHostRoute(page: Page): Promise<void> {
  await page.route(`${CUSTOM_HOST}/**`, route => {
    const url = route.request().url();
    route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: `custom ${url}`
    });
  });
}

async function ensureWarmController(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null,
        { timeout: 10_000 }
      );
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (
        message.includes('interrupted by another navigation') ||
        message.includes('Execution context was destroyed')
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error('failed to establish service worker controller in warm mode');
}

async function navigateAndWaitForRedirect(
  page: Page,
  target: string,
  expectedUrl: RegExp
): Promise<void> {
  const navigation = page.goto(target, { waitUntil: 'commit' }).catch(error => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (message.includes('ERR_ABORTED') || message.includes('interrupted by another navigation')) {
      return null;
    }
    throw error;
  });
  await expect.poll(() => page.url(), { timeout: 10_000 }).toMatch(expectedUrl);
  await navigation;
}

async function seedCustomBangs(
  page: Page,
  bangs: Array<{ trigger: string; name: string; url: string }>
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.waitForLoadState('domcontentloaded');
      await page.evaluate(
        async ({ customBangs, dbName }) => {
          await new Promise<void>((resolve, reject) => {
            const req = indexedDB.open(dbName, 1);

            req.onupgradeneeded = () => {
              const db = req.result;
              if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
              }
              if (!db.objectStoreNames.contains('custom-bangs')) {
                db.createObjectStore('custom-bangs', { keyPath: 'trigger' });
              }
            };

            req.onerror = () => {
              reject(req.error ?? new Error('failed to open IndexedDB'));
            };

            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction('custom-bangs', 'readwrite');
              const store = tx.objectStore('custom-bangs');
              for (const bang of customBangs) {
                store.put(bang);
              }
              tx.oncomplete = () => {
                db.close();
                resolve();
              };
              tx.onerror = () => {
                db.close();
                reject(tx.error ?? new Error('failed to write custom bangs'));
              };
              tx.onabort = () => {
                db.close();
                reject(tx.error ?? new Error('custom bang transaction aborted'));
              };
            };
          });
        },
        { customBangs: bangs, dbName: DB_NAME }
      );

      await page.evaluate(() => {
        navigator.serviceWorker.controller?.postMessage({ type: 'invalidate' });
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (message.includes('Execution context was destroyed')) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('failed to seed custom bangs after retries');
}

async function seedSettings(page: Page, settings: Record<string, string>): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.waitForLoadState('domcontentloaded');
      await page.evaluate(
        async ({ values, dbName }) => {
          await new Promise<void>((resolve, reject) => {
            const req = indexedDB.open(dbName, 1);

            req.onupgradeneeded = () => {
              const db = req.result;
              if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
              }
              if (!db.objectStoreNames.contains('custom-bangs')) {
                db.createObjectStore('custom-bangs', { keyPath: 'trigger' });
              }
            };

            req.onerror = () => {
              reject(req.error ?? new Error('failed to open IndexedDB'));
            };

            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction('settings', 'readwrite');
              const store = tx.objectStore('settings');
              for (const [key, value] of Object.entries(values)) {
                store.put({ key, value });
              }
              tx.oncomplete = () => {
                db.close();
                resolve();
              };
              tx.onerror = () => {
                db.close();
                reject(tx.error ?? new Error('failed to write settings'));
              };
              tx.onabort = () => {
                db.close();
                reject(tx.error ?? new Error('settings transaction aborted'));
              };
            };
          });
        },
        { values: settings, dbName: DB_NAME }
      );

      await page.evaluate(async () => {
        navigator.serviceWorker.controller?.postMessage({ type: 'invalidate' });
        const registration = await navigator.serviceWorker.getRegistration();
        registration?.active?.postMessage({ type: 'invalidate' });
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (message.includes('Execution context was destroyed')) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('failed to seed settings after retries');
}

function readSetting(page: Page, key: string): Promise<string | null> {
  return page.evaluate(
    ({ settingKey, dbName }) => {
      return new Promise<string | null>((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);

        req.onerror = () => {
          reject(req.error ?? new Error('failed to open IndexedDB'));
        };

        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('settings', 'readonly');
          const store = tx.objectStore('settings');
          const getReq = store.get(settingKey);
          getReq.onerror = () => {
            db.close();
            reject(getReq.error ?? new Error('failed to read setting'));
          };
          getReq.onsuccess = () => {
            const value = (getReq.result as { value?: string } | undefined)?.value ?? null;
            db.close();
            resolve(value);
          };
        };
      });
    },
    { settingKey: key, dbName: DB_NAME }
  );
}

test('suggest endpoint returns 400 when q parameter is missing', async ({ request }) => {
  const response = await request.get('/suggest');
  expect(response.status()).toBe(400);
  await expect(response.text()).resolves.toContain('Missing q parameter');
});

test('suggest endpoint respects provider override via sp=none', async ({ request }) => {
  const response = await request.get('/suggest', {
    params: { q: 'hello', sp: 'none' }
  });
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual(['hello', []]);
});

test('suggestions include custom bang entries from the suggest cookie', async ({ page }) => {
  await page.goto('/health');
  const customBang = 'mycustombang';
  const query = '!mycustom';
  await page.evaluate(
    suggestCookie => {
      document.cookie = `suggest=${suggestCookie};path=/`;
    },
    encodeSuggestCookieValue('default', 'g', '', [customBang])
  );

  const response = await page.evaluate(async q => {
    const res = await fetch(`/suggest?q=${encodeURIComponent(q)}`);
    return {
      status: res.status,
      payload: await res.json()
    };
  }, query);
  expect(response.status).toBe(200);

  const payload = response.payload;
  expect(payload[0]).toBe(query);
  expect(payload[1]).toContain(`!${customBang}`);
});

test('warm redirect uses service worker controlled fetch path', async ({ page }) => {
  await mockGoogleSearchRoute(page);
  await ensureWarmController(page);
  await navigateAndWaitForRedirect(page, '/?q=%21g%20hello', GOOGLE_REDIRECT);
  expect(page.url()).toMatch(GOOGLE_REDIRECT);
});

test('warm redirect supports suffix bang syntax', async ({ page }) => {
  await mockGoogleSearchRoute(page);
  await ensureWarmController(page);
  await navigateAndWaitForRedirect(page, '/?q=hello%20g%21', GOOGLE_REDIRECT);
  const redirected = new URL(page.url());
  expect(redirected.searchParams.get('q')).toBe('hello');
});

test('warm redirect falls back to default search for unknown bangs', async ({ page }) => {
  await mockGoogleSearchRoute(page);
  await ensureWarmController(page);
  await seedSettings(page, { 'default-bang': 'g' });
  await navigateAndWaitForRedirect(page, '/?q=%21zzzb%20hello', /google\.com\/search\?/);
  const redirected = new URL(page.url());
  expect(redirected.hostname).toBe('www.google.com');
  expect(redirected.pathname).toBe('/search');
  expect(redirected.searchParams.get('q')).toBe('!zzzb hello');
});

test('warm redirect uses lucky URL for trailing bare bang', async ({ page }) => {
  await mockGoogleSearchRoute(page);
  await ensureWarmController(page);
  await seedSettings(page, { 'default-bang': 'g' });
  await navigateAndWaitForRedirect(page, '/?q=hello%20%21', /google\.com\/search\?/);
  const redirected = new URL(page.url());
  expect(redirected.searchParams.get('q')).toBe('hello');
  expect(redirected.searchParams.get('btnI')).toBe('1');
});

test('custom bang redirects to custom target', async ({ page }) => {
  await mockCustomHostRoute(page);
  await ensureWarmController(page);
  await seedCustomBangs(page, [
    {
      trigger: 'mydocs',
      name: 'My Docs',
      url: `${CUSTOM_HOST}/search?q={}`
    }
  ]);

  await navigateAndWaitForRedirect(page, '/?q=%21mydocs%20hello', /example\.com\/search\?q=hello/);
  const redirected = new URL(page.url());
  expect(redirected.hostname).toBe('example.com');
  expect(redirected.pathname).toBe('/search');
  expect(redirected.searchParams.get('q')).toBe('hello');
});

test('custom bang overrides built-in bang trigger', async ({ page }) => {
  await mockGoogleSearchRoute(page);
  await mockCustomHostRoute(page);
  await ensureWarmController(page);
  await seedCustomBangs(page, [
    {
      trigger: 'g',
      name: 'Custom G',
      url: `${CUSTOM_HOST}/override?q={}`
    }
  ]);

  await navigateAndWaitForRedirect(page, '/?q=%21g%20hello', /example\.com\/override\?q=hello/);
  const redirected = new URL(page.url());
  expect(redirected.hostname).toBe('example.com');
  expect(redirected.pathname).toBe('/override');
  expect(redirected.searchParams.get('q')).toBe('hello');
});

test('custom bang with no term redirects to custom origin', async ({ page }) => {
  await mockCustomHostRoute(page);
  await ensureWarmController(page);
  await seedCustomBangs(page, [
    {
      trigger: 'mydocs',
      name: 'My Docs',
      url: `${CUSTOM_HOST}/search?q={}`
    }
  ]);

  await navigateAndWaitForRedirect(page, '/?q=%21mydocs', /example\.com/);
  const redirected = new URL(page.url());
  expect(redirected.origin).toBe(CUSTOM_HOST);
});

test('custom bang supports suffix syntax', async ({ page }) => {
  await mockCustomHostRoute(page);
  await ensureWarmController(page);
  await seedCustomBangs(page, [
    {
      trigger: 'mydocs',
      name: 'My Docs',
      url: `${CUSTOM_HOST}/search?q={}`
    }
  ]);

  await navigateAndWaitForRedirect(page, '/?q=hello%20mydocs%21', /example\.com\/search\?q=hello/);
  const redirected = new URL(page.url());
  expect(redirected.hostname).toBe('example.com');
  expect(redirected.searchParams.get('q')).toBe('hello');
});

test('custom bang persists after reload in the same context', async ({ page }) => {
  await mockCustomHostRoute(page);
  await ensureWarmController(page);
  await seedCustomBangs(page, [
    {
      trigger: 'mydocs',
      name: 'My Docs',
      url: `${CUSTOM_HOST}/search?q={}`
    }
  ]);

  await navigateAndWaitForRedirect(page, '/?q=%21mydocs%20first', /example\.com\/search\?q=first/);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ensureWarmController(page);
  await navigateAndWaitForRedirect(
    page,
    '/?q=%21mydocs%20second',
    /example\.com\/search\?q=second/
  );
  const redirected = new URL(page.url());
  expect(redirected.searchParams.get('q')).toBe('second');
});

test('cold-start redirect uses service worker message path before controller exists', async ({
  browser
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await mockGoogleSearchRoute(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await seedSettings(page, { 'default-bang': 'g' });
  const target = '/?q=%21g%20hello';
  const hasController = await page.evaluate(() => {
    if (!('serviceWorker' in navigator)) {
      return false;
    }
    return navigator.serviceWorker.controller !== null;
  });

  if (hasController) {
    await navigateAndWaitForRedirect(page, target, GOOGLE_REDIRECT);
  } else {
    await Promise.all([
      page.waitForURL(GOOGLE_REDIRECT),
      page.goto(target, { waitUntil: 'commit' })
    ]);
  }
  expect(await page.url()).toMatch(GOOGLE_REDIRECT);
  await context.close();
});

test('cold-start redirect records stats for the redirected bang', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await mockGoogleSearchRoute(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const target = '/?q=%21g%20hello';
  const hasController = await page.evaluate(() => {
    if (!('serviceWorker' in navigator)) {
      return false;
    }
    return navigator.serviceWorker.controller !== null;
  });

  if (hasController) {
    await navigateAndWaitForRedirect(page, target, GOOGLE_REDIRECT);
  } else {
    await Promise.all([
      page.waitForURL(GOOGLE_REDIRECT),
      page.goto(target, { waitUntil: 'commit' })
    ]);
  }

  const statsPage = await context.newPage();
  await statsPage.goto('/stats', { waitUntil: 'domcontentloaded' });
  const frecencyRaw = await readSetting(statsPage, 'frecency');
  expect(frecencyRaw).not.toBeNull();
  expect(frecencyRaw).toContain('"g"');

  await expect(statsPage.locator('#stats-detail-panel')).toContainText('!g');
  await context.close();
});

test('stats clear flow cancels on click-away and restores after soft delete', async ({ page }) => {
  await mockGoogleSearchRoute(page);
  await ensureWarmController(page);
  await navigateAndWaitForRedirect(page, '/?q=%21g%20react', /google\.com\/search\?q=react/);
  await page.goto('/stats', { waitUntil: 'domcontentloaded' });
  const snapshotRaw = await readSetting(page, 'frecency');
  expect(snapshotRaw).not.toBeNull();
  const expectedSnapshot = deserializeFrecencySnapshot(snapshotRaw);
  await page.getByRole('button', { name: 'Clear history' }).click();
  await expect(page.locator('#stats-clear-confirm')).toBeVisible();
  await page.locator('body').click({ position: { x: 20, y: 20 } });
  await expect(page.locator('#stats-clear-confirm')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Clear history' })).toBeVisible();

  await page.getByRole('button', { name: 'Clear history' }).click();
  await page.getByRole('button', { name: 'Confirm clearing local stats' }).click();
  await expect(page.locator('#stats-restore-banner')).toBeVisible();
  await expect(page.locator('#stats-empty')).toBeVisible();

  await page.getByRole('button', { name: 'Restore stats' }).click();
  await expect
    .poll(async () => {
      const restored = deserializeFrecencySnapshot(await readSetting(page, 'frecency'));
      return JSON.stringify({
        entries: restored.entries,
        weeklyBuckets: restored.weeklyBuckets
      });
    })
    .toBe(
      JSON.stringify({
        entries: expectedSnapshot.entries,
        weeklyBuckets: expectedSnapshot.weeklyBuckets
      })
    );
});

test('stats query memory pill replays the saved bang search', async ({ page }) => {
  await mockGoogleSearchRoute(page);
  await ensureWarmController(page);
  await navigateAndWaitForRedirect(page, '/?q=%21g%20react', /google\.com\/search\?q=react/);
  await page.goto('/stats', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Repeat search !g react' }).click();
  await expect.poll(() => page.url(), { timeout: 10_000 }).toMatch(/google\.com\/search\?q=react/);
});
