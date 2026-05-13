import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join, normalize } from 'node:path';
import { Readable } from 'node:stream';
import { handleOpenSearchRequest, handleSuggestRequest } from '../src/server/handlers';
import { pageHeaders, SW_HEADERS } from '../src/server/headers';
import { getStaticRedirect } from '../src/server/redirects';
import { readPathname } from '../src/shared/raw-url';
import { buildSite } from './site-build';

const SECURITY_HEADERS = pageHeaders("'unsafe-inline'");
const WATCH_REBUILD_DEBOUNCE_MS = 1500;
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

interface SSEClient {
  close: () => void;
  enqueue: (data: string) => void;
}

const clients = new Set<SSEClient>();

function redirectResponse(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { Location: location }
  });
}

function injectLiveReload(html: string): string {
  const idx = html.lastIndexOf('</body>');
  if (idx !== -1) {
    return html.slice(0, idx) + LIVE_RELOAD_SCRIPT + html.slice(idx);
  }
  return html + LIVE_RELOAD_SCRIPT;
}

function htmlResponse(html: string, headers?: Record<string, string>): Response {
  return new Response(injectLiveReload(html), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...SECURITY_HEADERS,
      ...headers
    }
  });
}

function contentType(path: string): string | null {
  if (path.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }
  if (path.endsWith('.js')) {
    return 'text/javascript; charset=utf-8';
  }
  if (path.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }
  if (path.endsWith('.json') || path.endsWith('.webmanifest')) {
    return 'application/json; charset=utf-8';
  }
  if (path.endsWith('.svg')) {
    return 'image/svg+xml';
  }
  if (path.endsWith('.png')) {
    return 'image/png';
  }
  if (path.endsWith('.ico')) {
    return 'image/x-icon';
  }
  if (path.endsWith('.xml')) {
    return 'application/xml; charset=utf-8';
  }
  if (path.endsWith('.txt')) {
    return 'text/plain; charset=utf-8';
  }
  return null;
}

async function fileResponse(path: string): Promise<Response | null> {
  try {
    const body = await readFile(path);
    const type = contentType(path);
    return new Response(body, {
      headers: {
        ...(type ? { 'Content-Type': type } : {}),
        ...SECURITY_HEADERS
      }
    });
  } catch {
    return null;
  }
}

function requestFromNode(req: IncomingMessage): Request {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const body =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : (Readable.toWeb(req) as BodyInit);
  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers: new Headers(req.headers as Record<string, string>),
    body
  };
  if (body) {
    init.duplex = 'half';
  }
  return new Request(url, init);
}

async function sendNodeResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  for (const [key, value] of response.headers) {
    res.setHeader(key, value);
  }
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    res.write(value);
  }
  res.end();
}

function broadcast(): void {
  const dead: SSEClient[] = [];
  for (const client of clients) {
    try {
      client.enqueue('data: reload\n\n');
    } catch {
      dead.push(client);
    }
  }
  for (const client of dead) {
    clients.delete(client);
  }
}

async function build(): Promise<void> {
  const start = performance.now();
  await buildSite({ clean: false, dev: true });
  console.log(`Build done in ${(performance.now() - start).toFixed(0)}ms`);
}

await build();

let timeout: NodeJS.Timeout;
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
    } catch (error) {
      console.error('Build failed:', error);
    }
  }, WATCH_REBUILD_DEBOUNCE_MS);
});

const port = Number(process.env.PORT) || 3000;
console.log(`Dev server: http://localhost:${port}`);

createServer(async (req, res) => {
  const request = requestFromNode(req);
  const pathname = readPathname(request.url);
  const redirectTarget = getStaticRedirect(pathname);

  if (redirectTarget) {
    const url = new URL(request.url);
    await sendNodeResponse(redirectResponse(`${redirectTarget}${url.search}`), res);
    return;
  }

  if (pathname === '/__dev/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    const client: SSEClient = {
      enqueue: (data: string) => {
        res.write(data);
      },
      close: () => {
        res.end();
      }
    };
    clients.add(client);
    client.enqueue(': connected\n\n');
    req.on('close', () => {
      clients.delete(client);
    });
    return;
  }

  if (pathname === '/suggest') {
    const response = await handleSuggestRequest(request);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(key, value);
    }
    await sendNodeResponse(response, res);
    return;
  }

  if (pathname === '/opensearch.xml') {
    const response = handleOpenSearchRequest(request);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(key, value);
    }
    await sendNodeResponse(response, res);
    return;
  }

  if (pathname === '/sw.js') {
    await sendNodeResponse(
      new Response(await readFile('dist/sw.js'), { headers: SW_HEADERS }),
      res
    );
    return;
  }

  const path = pathname === '/' ? '/index.html' : pathname;
  const normalized = normalize(`dist${path}`);
  if (!normalized.startsWith('dist/')) {
    await sendNodeResponse(
      new Response('Not found', { status: 404, headers: SECURITY_HEADERS }),
      res
    );
    return;
  }

  const directFile = await fileResponse(normalized);
  if (directFile) {
    if (path.endsWith('.html')) {
      await sendNodeResponse(htmlResponse(await directFile.text()), res);
      return;
    }
    await sendNodeResponse(directFile, res);
    return;
  }

  const htmlNormalized = normalize(`dist${path}.html`);
  if (htmlNormalized.startsWith('dist/')) {
    const html = await fileResponse(htmlNormalized);
    if (html) {
      await sendNodeResponse(htmlResponse(await html.text()), res);
      return;
    }
  }

  await sendNodeResponse(htmlResponse(await readFile(join('dist', 'index.html'), 'utf8')), res);
}).listen(port);
