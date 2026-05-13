import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { brotliCompressSync, constants } from 'node:zlib';
import { pageHeaders, SW_CSP } from '../src/server/headers';
import { buildSite, distFiles, HTML_PAGES } from './site-build';

function extractScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  for (const match of html.matchAll(re)) {
    const hash = createHash('sha256').update(match[1]).digest('base64');
    hashes.push(`'sha256-${hash}'`);
  }
  return hashes;
}

function routeHeaders(pageFile: string, cspHeader: string): string[] {
  const route = pageFile === 'index.html' ? '/' : `/${pageFile.replace(/\.html$/, '')}`;
  return [route, `  ${cspHeader}`, '', `/${pageFile}`, `  ${cspHeader}`, ''];
}

await buildSite({ clean: true, dev: false });

console.log('=== Generate _headers with CSP ===');
const htmlFiles = HTML_PAGES.map(file => `dist/${file}`);
const scriptHashes = (await Promise.all(htmlFiles.map(file => readFile(file, 'utf8')))).flatMap(
  extractScriptHashes
);
const { 'Content-Security-Policy': pageCsp, ...baseHeaders } = pageHeaders(scriptHashes.join(' '));
const securityHeaders = Object.entries(baseHeaders)
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n  ');
const pageCspHeader = `Content-Security-Policy: ${pageCsp}`;
const swCspHeader = `Content-Security-Policy: ${SW_CSP}`;

await writeFile(
  'dist/_headers',
  [
    '/*',
    `  ${securityHeaders}`,
    '',
    ...HTML_PAGES.flatMap(file => routeHeaders(file, pageCspHeader)),
    '/sw.js',
    `  ${swCspHeader}`,
    '',
    '/opensearch.xml',
    '  Content-Type: application/opensearchdescription+xml',
    ''
  ].join('\n')
);

console.log('=== Pre-compress static assets ===');
for (const file of await distFiles()) {
  if (!/\.(html|js|svg|json|txt)$/u.test(file)) {
    continue;
  }
  const content = await readFile(`dist/${file}`);
  const br = brotliCompressSync(content, {
    params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY }
  });
  await writeFile(`dist/${file}.br`, br);
}

console.log('=== Done ===');
for (const file of await distFiles()) {
  if (file.includes('/')) {
    continue;
  }
  const size = (await readFile(`dist/${file}`)).byteLength;
  const kb = (size / 1024).toFixed(1);
  console.log(`  ${file.padEnd(30)} ${kb} KB`);
}
