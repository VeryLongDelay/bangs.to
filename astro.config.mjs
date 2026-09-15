import { defineConfig } from 'astro/config';

const siteName = process.env.SITE_NAME?.trim() || 'ban.gs';

export default defineConfig({
  output: 'static',
  build: {
    format: 'file'
  },
  vite: {
    define: {
      'import.meta.env.SITE_NAME': JSON.stringify(siteName)
    }
  }
});
