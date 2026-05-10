import { minify } from '@minify-html/node';
import { $ } from 'bun';
import { watch } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { handleOpenSearchRequest, handleSuggestRequest } from '../src/server/handlers';
import { pageHeaders, SW_HEADERS } from '../src/server/headers';
import { getStaticRedirect } from '../src/server/redirects';
import { readPathname } from '../src/shared/raw-url';
import { copyStaticAssets } from './static-assets';
import { writeStructuredDataAsset } from './structured-data';

const SECURITY_HEADERS = pageHeaders("'unsafe-inline'");

interface SSEClient {
  close: () => void;
  enqueue: (data: string) => void;
}
const clients = new Set<SSEClient>();

function broadcast() {
  const dead: SSEClient[] = [];
  for (const client of clients) {
    try {
      client.enqueue('data: reload\n\n');
    } catch {
      dead.push(client);
    }
  }
  for (const c of dead) {
    clients.delete(c);
  }
}

const LIVE_RELOAD_SCRIPT = `<script>
const __es = new EventSource("/__dev/events");
__es.onmessage = async () => {
  __es.close();
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map(r => r.unregister()));
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  location.reload();
};
addEventListener("beforeunload", () => __es.close());
</script>`;

const ASTRO_OUTDIR = '.astro-build';

async function build() {
  const t = performance.now();
  await writeStructuredDataAsset();
  await mkdir('dist', { recursive: true });

  await Promise.all([
    Bun.build({
      entrypoints: ['src/sw/sw.ts'],
      outdir: 'dist',
      naming: 'sw.js',
      minify: true,
      target: 'browser',
      format: 'esm',
      define: {
        __CACHE_VERSION__: '"bangs-to-dev"',
        __EXTRA_ASSETS__: '[]',
        __IS_DEV__: JSON.stringify(true)
      }
    }),
    Bun.build({
      entrypoints: ['src/ui/app.ts'],
      outdir: 'dist',
      naming: 'app.js',
      splitting: true,
      minify: true,
      target: 'browser',
      format: 'esm'
    }),
    Bun.build({
      entrypoints: ['src/ui/bangs.ts'],
      outdir: 'dist',
      naming: 'bangs.js',
      splitting: true,
      minify: true,
      target: 'browser',
      format: 'esm'
    }),
    Bun.build({
      entrypoints: ['src/ui/stats.ts'],
      outdir: 'dist',
      naming: 'stats.js',
      splitting: true,
      minify: true,
      target: 'browser',
      format: 'esm'
    }),
    Bun.build({
      entrypoints: ['src/ui/theme.ts'],
      outdir: 'dist',
      naming: 'theme.js',
      minify: true,
      target: 'browser',
      format: 'esm'
    })
  ]);

  await $`bunx unocss "src/**/*.astro" "src/ui/**/*.ts" -o dist/styles.css --minify`.quiet();
  await $`bunx astro build --outDir ${ASTRO_OUTDIR}`.quiet();

  const css = await Bun.file('dist/styles.css').text();
  const inlineCSS = (src: string) =>
    src.replace('<link rel="stylesheet" href="/styles.css" />', `<style>${css}</style>`);

  for (const file of [
    'index.html',
    'home.html',
    'bangs.html',
    'stats.html',
    'contact.html',
    'faq.html',
    'instructions.html',
    'ai.html'
  ]) {
    const astroHtml = await Bun.file(join(ASTRO_OUTDIR, file)).text();
    await Bun.write(
      join('dist', file),
      minify(Buffer.from(inlineCSS(astroHtml)), {
        minify_css: true,
        minify_js: true
      })
    );
  }

  await Bun.write('dist/robots.txt', 'User-agent: *\nAllow: /\n');
  await copyStaticAssets('dist');

  console.log(`Build done in ${(performance.now() - t).toFixed(0)}ms`);
}

const generated = Bun.file('src/generated/bangs-min.js');
if (!(await generated.exists())) {
  console.warn('Generated bang data not found. Running codegen...');
  await $`bun run codegen`;
}

await build();

/** Batch rapid saves so rebuilds run less often (fs.watch may emit many events per edit). */
const WATCH_REBUILD_DEBOUNCE_MS = 2250;

let timeout: Timer;
watch('src', { recursive: true }, (_event, filename) => {
  if (filename && (filename.endsWith('.test.ts') || filename.endsWith('.test.js'))) {
    return;
  }
  clearTimeout(timeout);
  timeout = setTimeout(async () => {
    console.log('File change detected, rebuilding...');
    try {
      await build();
      broadcast();
    } catch (e) {
      console.error('Build failed:', e);
    }
  }, WATCH_REBUILD_DEBOUNCE_MS);
});

function injectLiveReload(html: string): string {
  const idx = html.lastIndexOf('</body>');
  if (idx !== -1) {
    return html.slice(0, idx) + LIVE_RELOAD_SCRIPT + html.slice(idx);
  }
  return html + LIVE_RELOAD_SCRIPT;
}

function htmlResponse(file: string, headers?: Record<string, string>): Response {
  const content = injectLiveReload(file);
  return new Response(content, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...SECURITY_HEADERS,
      ...headers
    }
  });
}

const port = Number(process.env.PORT) || 3000;
console.log(`Dev server: http://localhost:${port}`);

Bun.serve({
  port,
  idleTimeout: 255,
  async fetch(req) {
    const pathname = readPathname(req.url);
    const redirectTarget = getStaticRedirect(pathname);

    if (redirectTarget) {
      const url = new URL(req.url);
      const location = `${redirectTarget}${url.search}`;
      return Response.redirect(location, 302);
    }

    if (pathname === '/__dev/events') {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const client: SSEClient = {
            enqueue: (data: string) => controller.enqueue(encoder.encode(data)),
            close: () => controller.close()
          };
          clients.add(client);
          client.enqueue(': connected\n\n');
          req.signal.addEventListener('abort', () => {
            clients.delete(client);
          });
        }
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    if (pathname === '/suggest') {
      const res = await handleSuggestRequest(req);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
        res.headers.set(k, v);
      }
      return res;
    }

    if (pathname === '/opensearch.xml') {
      const res = handleOpenSearchRequest(req);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
        res.headers.set(k, v);
      }
      return res;
    }

    if (pathname === '/sw.js') {
      return new Response(Bun.file('dist/sw.js'), { headers: SW_HEADERS });
    }

    const path = pathname === '/' ? '/index.html' : pathname;
    const normalized = normalize(`dist${path}`);
    if (!normalized.startsWith('dist/')) {
      return new Response('Not found', {
        status: 404,
        headers: SECURITY_HEADERS
      });
    }
    const file = Bun.file(normalized);
    if (await file.exists()) {
      if (path.endsWith('.html')) {
        return htmlResponse(await file.text());
      }
      return new Response(file, { headers: SECURITY_HEADERS });
    }
    const htmlNormalized = normalize(`dist${path}.html`);
    if (htmlNormalized.startsWith('dist/')) {
      const htmlFile = Bun.file(htmlNormalized);
      if (await htmlFile.exists()) {
        return htmlResponse(await htmlFile.text());
      }
    }
    return htmlResponse(await Bun.file('dist/index.html').text());
  }
});
