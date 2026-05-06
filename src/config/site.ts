export const SITE_TITLE = 'Bangs.to';
export const SITE_TAGLINE = 'A fast, local-first search tool for !bangs users';
export const SITE_URL = 'https://bangs.to';
export const OG_IMAGE_URL = `${SITE_URL}/ogimage.png`;
export const OG_DESCRIPTION =
  'Blazing-fast DuckDuckGo/Kagi-style !bangs for any search engine. Redirects cached browser-side to avoid DNS latency, powered by a JavaScript Service Worker.';

export function getSettingsHref(currentPath: string): string {
  return `${currentPath}#settings`;
}

export function getCanonicalUrl(currentPath: string): string {
  return `${SITE_URL}${currentPath === '/' ? '/' : currentPath}`;
}
