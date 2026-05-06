import { readFile, writeFile } from 'node:fs/promises';
import { OG_DESCRIPTION, OG_IMAGE_URL, SITE_TITLE, SITE_URL } from '../src/config/site';

export const SITE_JSONLD_PATH = 'src/ui/assets/site.jsonld';

export function createSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_TITLE,
        alternateName: 'bangs.to',
        description: OG_DESCRIPTION,
        image: OG_IMAGE_URL,
        inLanguage: 'en-US',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/?q={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#app`,
        name: SITE_TITLE,
        applicationCategory: 'BrowserApplication',
        operatingSystem: 'Web',
        url: SITE_URL,
        image: OG_IMAGE_URL,
        description: OG_DESCRIPTION,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        },
        isAccessibleForFree: true,
        featureList: [
          'Bang redirects',
          'Local-first search shortcuts',
          'Privacy-preserving local stats',
          'OpenSearch support'
        ]
      }
    ]
  };
}

export async function writeStructuredDataAsset(): Promise<void> {
  const next = `${JSON.stringify(createSiteJsonLd(), null, 2)}\n`;
  let current = '';

  try {
    current = await readFile(SITE_JSONLD_PATH, 'utf8');
  } catch {
    current = '';
  }

  if (current !== next) {
    await writeFile(SITE_JSONLD_PATH, next);
  }
}
