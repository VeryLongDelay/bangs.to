import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SITE_TITLE } from '../src/config/site';

const UI_DIR = 'src/ui';
const ASSETS_DIR = join(UI_DIR, 'assets');

const ROOT_ASSET_ALIASES = [
  ['site.webmanifest', 'site.webmanifest'],
  ['apple/apple-touch-icon.png', 'apple-touch-icon.png'],
  ['favicon/favicon-16x16.png', 'favicon-16x16.png'],
  ['favicon/favicon-32x32.png', 'favicon-32x32.png'],
  ['favicon/favicon-48x48.png', 'favicon-48x48.png'],
  ['favicon/favicon.ico', 'favicon.ico'],
  ['android/android-chrome-192x192.png', 'android-chrome-192x192.png'],
  ['android/android-chrome-512x512.png', 'android-chrome-512x512.png'],
  ['android/maskable-icon-192x192.png', 'maskable-icon-192x192.png'],
  ['android/maskable-icon-512x512.png', 'maskable-icon-512x512.png'],
  ['ogimage.png', 'ogimage.png']
] as const;

async function copyDir(sourceDir: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter(entry => !entry.name.startsWith('.'))
      .map(async entry => {
        const sourcePath = join(sourceDir, entry.name);
        const destPath = join(destDir, entry.name);
        if (entry.isDirectory()) {
          await copyDir(sourcePath, destPath);
          return;
        }
        await copyFile(sourcePath, destPath);
      })
  );
}

export async function copyStaticAssets(outDir: string): Promise<void> {
  await copyDir(ASSETS_DIR, join(outDir, 'assets'));

  await Promise.all([
    copyFile(join(UI_DIR, 'icon.svg'), join(outDir, 'icon.svg')),
    ...ROOT_ASSET_ALIASES.map(([sourcePath, destPath]) =>
      copyFile(join(ASSETS_DIR, sourcePath), join(outDir, destPath))
    )
  ]);

  const manifestPath = join(outDir, 'site.webmanifest');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    name: string;
    short_name: string;
  };
  manifest.name = SITE_TITLE;
  manifest.short_name = SITE_TITLE;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
