import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { normalize } from 'node:path';
import { Readable } from 'node:stream';
import { handleOpenSearchRequest, handleSuggestRequest } from '../src/server/handlers';
import { pageHeaders, SW_HEADERS } from '../src/server/headers';
import { getStaticRedirect } from '../src/server/redirects';
import { readPathname } from '../src/shared/raw-url';
import { listFilesRecursive, pathExists } from './package-tools';

const SECURITY_HEADERS = pageHeaders("'unsafe-inline'");

interface StaticAsset {
  br: Buffer | null;
  body: Buffer;
  type: string | null;
}

function redirectResponse(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { Location: location }
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

async function buildStaticManifest(): Promise<Map<string, StaticAsset>> {
  const files = await listFilesRecursive('dist');
  const byName = new Set(files);
  const map = new Map<string, StaticAsset>();

  for (const name of files) {
    if (name.endsWith('.br')) {
      continue;
    }
    const filePath = `dist/${name}`;
    const brPath = `dist/${name}.br`;
    const [body, br] = await Promise.all([
      readFile(filePath),
      byName.has(`${name}.br`) ? readFile(brPath) : Promise.resolve(null)
    ]);
    map.set(`/${name}`, {
      body,
      br,
      type: contentType(name)
    });
  }

  return map;
}

const distIndexExists = await pathExists('dist/index.html');
if (!distIndexExists) {
  console.error('dist/index.html not found. Run `pnpm run build` first.');
  process.exit(1);
}

const STATIC_MANIFEST = await buildStaticManifest();
const SW_FILE = STATIC_MANIFEST.get('/sw.js')?.body ?? (await readFile('dist/sw.js'));

function serveCompressed(req: Request, assetPath: string, extraHeaders?: Record<string, string>) {
  const asset = STATIC_MANIFEST.get(assetPath);
  if (!asset) {
    return null;
  }

  const accept = req.headers.get('accept-encoding') ?? '';

  if (asset.br && accept.includes('br')) {
    return new Response(new Uint8Array(asset.br), {
      headers: {
        'Content-Encoding': 'br',
        ...(asset.type ? { 'Content-Type': asset.type } : {}),
        ...SECURITY_HEADERS,
        ...extraHeaders
      }
    });
  }

  return new Response(new Uint8Array(asset.body), {
    headers: {
      ...(asset.type ? { 'Content-Type': asset.type } : {}),
      ...SECURITY_HEADERS,
      ...extraHeaders
    }
  });
}

const port = Number(process.env.PORT) || 3000;
console.log(`Production server: http://localhost:${port}`);

createServer(async (req, res) => {
  const request = requestFromNode(req);
  const pathname = readPathname(request.url);
  const redirectTarget = getStaticRedirect(pathname);

  if (redirectTarget) {
    const url = new URL(request.url);
    await sendNodeResponse(redirectResponse(`${redirectTarget}${url.search}`), res);
    return;
  }

  if (pathname === '/health') {
    await sendNodeResponse(new Response('ok'), res);
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
    await sendNodeResponse(new Response(new Uint8Array(SW_FILE), { headers: SW_HEADERS }), res);
    return;
  }

  const path = pathname === '/' ? '/index.html' : pathname;
  const normalized = normalize(`dist${path}`);
  if (!normalized.startsWith('dist/')) {
    await sendNodeResponse(
      new Response('Not found', {
        status: 404,
        headers: SECURITY_HEADERS
      }),
      res
    );
    return;
  }

  const fromDist = serveCompressed(request, `/${normalized.substring(5)}`);
  if (fromDist) {
    await sendNodeResponse(fromDist, res);
    return;
  }

  const htmlNormalized = normalize(`dist${path}.html`);
  if (htmlNormalized.startsWith('dist/')) {
    const fromHtml = serveCompressed(request, `/${htmlNormalized.substring(5)}`);
    if (fromHtml) {
      await sendNodeResponse(fromHtml, res);
      return;
    }
  }

  await sendNodeResponse(serveCompressed(request, '/index.html')!, res);
}).listen(port);
