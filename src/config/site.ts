type RuntimeEnv = { process?: { env?: Record<string, string | undefined> } };

const runtimeEnv = (globalThis as typeof globalThis & RuntimeEnv).process?.env;
const astroEnv = (import.meta as ImportMeta & { env?: ImportMetaEnv & { SITE_NAME?: string } }).env;
const astroSiteName = astroEnv?.SITE_NAME;

/** Public site name. Configure with SITE_NAME in astro.config.mjs or the environment. */
export const SITE_TITLE = astroSiteName?.trim() || runtimeEnv?.SITE_NAME?.trim() || 'ban.gs';
export const SITE_TAGLINE = 'A fast, local-first search tool for !bangs users';
export const SITE_URL = 'https://ban.gs';
export const SITE_DOMAIN = 'ban.gs';
export const OG_IMAGE_URL = `${SITE_URL}/ogimage.png`;
export const OG_DESCRIPTION =
  'Blazing-fast DuckDuckGo/Kagi-style !bangs for any search engine. Redirects cached browser-side to avoid DNS latency, powered by a JavaScript Service Worker.';
export const TWITTER_SITE = '@ban__gs';

export function getSettingsHref(currentPath: string): string {
  return `${currentPath}#settings`;
}

export function getCanonicalUrl(currentPath: string): string {
  return `${SITE_URL}${currentPath === '/' ? '/' : currentPath}`;
}
