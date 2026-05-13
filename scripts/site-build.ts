import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import minifyHtml from '@minify-html/node';
import { build as esbuild } from 'esbuild';
import { ensureGeneratedBangData } from './codegen';
import { listFilesRecursive, runLocalBin } from './package-tools';
import { copyStaticAssets } from './static-assets';
import { writeStructuredDataAsset } from './structured-data';

export const ASTRO_OUTDIR = '.astro-build';
export const HTML_PAGES = [
  '404.html',
  'ai.html',
  'bangs.html',
  'contact.html',
  'faq.html',
  'home.html',
  'index.html',
  'instructions.html',
  'privacy.html',
  'stats.html'
] as const;

const SIZE_THRESHOLD = 50 * 1024;

function inlineCssIntoHtml(html: string, css: string): string {
  return html.replace(
    /<link rel="stylesheet" href="\/styles\.css"\s*\/?>/,
    `<style>${css}</style>`
  );
}

async function buildUiEntries() {
  return await esbuild({
    entryPoints: {
      app: 'src/ui/app.ts',
      bangs: 'src/ui/bangs.ts',
      stats: 'src/ui/stats.ts',
      theme: 'src/ui/theme.ts'
    },
    outdir: 'dist',
    entryNames: '[name]',
    chunkNames: 'chunk-[hash]',
    bundle: true,
    splitting: true,
    minify: true,
    platform: 'browser',
    target: ['chrome100', 'firefox100', 'safari15'],
    format: 'esm',
    metafile: true,
    write: true
  });
}

function extraAssetsFromOutputs(outputs: Record<string, { bytes: number }>): string[] {
  return Object.entries(outputs)
    .filter(([path, output]) => {
      const filename = path.split('/').pop();
      return (
        output.bytes < SIZE_THRESHOLD &&
        filename !== 'app.js' &&
        filename !== 'bangs.js' &&
        filename !== 'stats.js' &&
        filename !== 'theme.js'
      );
    })
    .map(([path]) => `/${path.split('/').pop()!}`);
}

async function cacheVersionFromOutputs(
  outputs: Record<string, { bytes: number }>
): Promise<string> {
  const fingerprints: string[] = [];

  for (const path of Object.keys(outputs).sort((a, b) => a.localeCompare(b))) {
    const contentHash = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
    fingerprints.push(`${path}:${contentHash}`);
  }

  return `fb-${createHash('sha256').update(fingerprints.join(',')).digest('hex').slice(0, 8)}`;
}

async function buildServiceWorker(cacheVersion: string, extraAssets: string[], dev: boolean) {
  await esbuild({
    entryPoints: ['src/sw/sw.ts'],
    outfile: 'dist/sw.js',
    bundle: true,
    minify: true,
    platform: 'browser',
    target: ['chrome100', 'firefox100', 'safari15'],
    format: 'esm',
    define: {
      __CACHE_VERSION__: JSON.stringify(cacheVersion),
      __EXTRA_ASSETS__: JSON.stringify(extraAssets),
      __IS_DEV__: JSON.stringify(dev)
    }
  });
}

async function writeHtmlOutputs() {
  const css = await readFile('dist/styles.css', 'utf8');

  for (const file of HTML_PAGES) {
    const astroHtml = await readFile(join(ASTRO_OUTDIR, file), 'utf8');
    await writeFile(
      join('dist', file),
      minify(Buffer.from(inlineCssIntoHtml(astroHtml, css)), {
        minify_css: true,
        minify_js: true
      })
    );
  }

  await rm('dist/styles.css', { force: true });
}

export async function buildSite({ clean, dev }: { clean: boolean; dev: boolean }): Promise<void> {
  await ensureGeneratedBangData(true);
  await writeStructuredDataAsset();

  if (clean) {
    await rm('dist', { recursive: true, force: true });
  }

  await rm(ASTRO_OUTDIR, { recursive: true, force: true });
  await mkdir('dist', { recursive: true });

  console.log('=== Bundle app + bangs + stats + theme ===');
  const uiBuild = await buildUiEntries();
  const outputs = uiBuild.metafile?.outputs ?? {};
  const cacheVersion = dev ? 'bangs-to-dev' : await cacheVersionFromOutputs(outputs);
  const extraAssets = dev ? [] : extraAssetsFromOutputs(outputs);

  if (!dev) {
    console.log(`Cache version: ${cacheVersion}`);
    if (extraAssets.length > 0) {
      console.log(`Extra assets: ${extraAssets.join(', ')}`);
    }
  }

  console.log('=== Bundle service worker ===');
  await buildServiceWorker(cacheVersion, extraAssets, dev);

  console.log('=== Generate CSS ===');
  await runLocalBin('unocss', [
    'src/**/*.astro',
    'src/ui/index.html',
    'src/ui/**/*.ts',
    '-o',
    'dist/styles.css',
    '--minify'
  ]);

  console.log('=== Build Astro pages ===');
  await runLocalBin('astro', ['build', '--outDir', ASTRO_OUTDIR]);

  console.log('=== Inline CSS + minify HTML ===');
  await writeHtmlOutputs();
  await rm(ASTRO_OUTDIR, { recursive: true, force: true });

  await copyStaticAssets('dist');
  await writeFile('dist/robots.txt', 'User-agent: *\nAllow: /\n');
  await writeFile('dist/_redirects', '/history /stats 302\n/history.html /stats 302\n');
}

export async function distFiles(): Promise<string[]> {
  return await listFilesRecursive('dist');
}
const { minify } = minifyHtml;
