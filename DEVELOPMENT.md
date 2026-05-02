# Development

High-level notes for AI-assisted work live in [`AGENTS.md`](AGENTS.md).

## Prerequisites

- [Bun](https://bun.sh) (runtime and bundler)

## Commands

```sh
bun install        # install dependencies
bun run check      # format + lint check (fails on issues)
bun run fix        # auto-fix format + lint issues
bun run codegen    # fetch DDG/Kagi sources, merge, and generate bang maps
bun run build      # full pipeline: JS bundles + Astro pages + CSS inline + Brotli (auto-runs codegen --from-merged if generated bang files are missing)
bun run dev        # same artifacts as build, served with file watching & live reload (auto-runs codegen if needed)
bun run start      # serve pre-built dist/ (run `bun run build` first)
bun run typecheck  # type-check with tsc (no emit)
bun run profile    # run performance profile benchmarks (auto-runs codegen --from-merged if generated bang files are missing)
bun test           # run tests
bun run test:e2e   # run Playwright end-to-end tests (build + browser run)
bun run clean      # remove dist/

# Cloudflare Pages (requires Wrangler login / project config)
bun run deploy     # codegen --from-merged + build + wrangler pages deploy dist
bun run preview    # codegen --from-merged + build + wrangler pages dev

# Astro only (writes `.astro-build/`; production HTML still goes through `build` / `dev`)
bun run build:astro

# Lower-level bundling (normally invoked via `build`, not needed day-to-day)
bun run build:sw
bun run build:ui
bun run build:css
```

## Project structure

```
flashbang/
├── functions/
│   ├── suggest.ts            # Cloudflare Pages Function for /suggest
│   └── opensearch.xml.ts     # Cloudflare Pages Function for /opensearch.xml
├── scripts/
│   ├── codegen.ts            # Fetch sources, parse, merge, generate bang maps
│   ├── build.ts              # Bundle + minify pipeline
│   ├── dev.ts                # Dev server with file watching, rebuild & live reload
│   ├── profile.ts            # Profiling script
│   └── start.ts              # Production server (serves pre-built dist/)
├── data/
│   ├── bangs.json            # Merged bang data (committed, updated by CI daily)
│   ├── custom-bangs.json     # Custom bang definitions
│   ├── ddg.json              # DuckDuckGo source (gitignored, fetched by codegen)
│   └── kagi.json             # Kagi source (gitignored, fetched by codegen)
├── src/
│   ├── pages/                 # Astro routes → static HTML (index, home, bangs, faq, instructions, bench)
│   ├── components/            # Astro components (layout chrome, try-search, settings modal, etc.)
│   ├── layouts/               # Astro layouts (e.g. SiteLayout)
│   ├── env.d.ts               # Astro / ambient typings
│   ├── suggest.ts             # Bang suggestions, search suggest proxy & cookie parsing
│   ├── suggest-bang.ts        # Bang suggestion matching and scoring
│   ├── opensearch.ts          # OpenSearch XML generation
│   ├── server/
│   │   ├── handlers.ts        # Production server request handlers
│   │   └── headers.ts         # CSP and security headers (shared across all targets)
│   ├── shared/
│   │   ├── chars.ts           # Character classification helpers
│   │   ├── constants.ts       # Shared constants
│   │   ├── idb.ts             # Shared IndexedDB open helper
│   │   ├── raw-query.ts       # Raw query string parsing
│   │   ├── raw-url.ts         # Raw URL pathname and origin parsing
│   │   ├── suggest-cookie.ts  # Shared suggest cookie helpers
│   │   ├── template.ts        # Bang URL template expansion
│   │   └── trie.ts            # Radix trie lookup
│   ├── generated/             # Output of codegen (gitignored, generated from data/bangs.json)
│   │   ├── bangs-min.js       # trigger→URL map for Service Worker
│   │   ├── bangs-meta.js      # trigger→{name, domain} for UI
│   │   ├── bangs-trie.js      # radix trie for prefix-matched bang suggestions
│   │   └── *.d.ts             # TypeScript declarations for each generated .js file
│   ├── sw/
│   │   ├── sw.ts              # Service Worker lifecycle & fetch handler
│   │   ├── redirect.ts        # Bang parsing & redirect logic (zero-copy raw + decoded paths)
│   │   ├── idb.ts             # IndexedDB access, settings cache & in-memory frecency
│   │   └── frecency.ts        # Top-K frecency helpers used by SW
│   └── ui/                    # Client JS entrypoints + static assets (bundled by Bun)
│       ├── app.ts             # Main app initialization & orchestration
│       ├── bangs.ts           # Bang browser page script
│       ├── bench.ts           # Benchmark script
│       ├── theme.ts           # Theme toggle script
│       ├── settings.ts        # Settings event wiring, bang search, import/export
│       ├── modal.ts           # Settings modal behavior
│       ├── custom-bangs.ts    # Custom bang list & add form
│       ├── bang-browser.ts    # Bang listing UI helpers
│       ├── cookie.ts          # Suggest cookie management (provider, custom bangs)
│       ├── db.ts              # IndexedDB wrapper
│       ├── dom.ts             # $() selector & el() factory
│       ├── sw-bridge.ts       # notifySW() — postMessage to Service Worker
│       ├── animations.ts      # Flash & shake CSS animations
│       ├── liquid-metal.ts    # WebGL2 shader effect
│       ├── try-search-examples.ts  # Example queries for the home try-search UI
│       ├── icon.svg           # App icon
│       ├── manifest.json      # PWA manifest
│       ├── opensearch.xml     # OpenSearch descriptor (copied/served per target)
│       └── _headers           # Dev/static host header hints (opensearch content-type)
├── astro.config.mjs           # Astro static site config
├── biome.jsonc                # Biome lint + format config
├── .dockerignore              # Files excluded from Docker build context
├── Dockerfile                 # Multi-stage Docker build
├── package.json
├── uno.config.ts              # UnoCSS theme
└── LICENSE
```

## Tests

```sh
bun test           # run all tests
bun run test:e2e   # run end-to-end tests (build + Playwright)
```

Unit tests:

- `tests/redirect.test.ts` — Bang parsing, routing logic, and URL encoding
- `tests/suggest.test.ts` — Cookie parsing, bang suggestions, and provider proxying
- `tests/raw-url.test.ts` — Raw URL pathname and origin parsing
- `tests/frecency.test.ts` — Top-K frecency ordering and serialization helpers
- `tests/handlers.test.ts` — Server-side suggest handler behavior and cookie cleanup

End-to-end tests:

- `tests/e2e/flashbang.e2e.ts` — Suggest endpoint behavior, warm/cold redirect flows, lucky redirects, and custom bang redirect scenarios

If this is your first Playwright run on a machine, install browsers once:

```sh
bunx playwright install
```

## Bang codegen

`bun run codegen` fetches bang sources and generates the JavaScript bang maps that `build` and `dev` depend on:

1. **Fetch sources** — Downloads bang definitions from DuckDuckGo (`bang.js`) and Kagi (`bangs.json`) into `data/`
2. **Merge + validate** — Parses DDG, Kagi, and custom sources. Merges by trigger (deduplicates), validates URLs, and saves the merged result to `data/bangs.json`
3. **Generate** — Produces three JS files in `src/generated/` from the merged data:
   - `bangs-min.js` — trigger→URL map for the Service Worker
   - `bangs-meta.js` — trigger→{name, domain} for the UI
   - `bangs-trie.js` — radix trie for prefix-matched bang suggestions
   - plus matching `*.d.ts` declaration files for all generated modules

The `--from-merged` flag skips steps 1–2 and generates directly from the committed `data/bangs.json`. This is what CI builds use — no network fetch needed.

The bang data is split into two tiers so the Service Worker loads only what it needs for fast redirects, while the UI gets the full metadata for searching and display.

## Content Security Policy

CSP headers are defined in `src/server/headers.ts` — the single source of truth for all deployment targets. The page CSP and SW CSP differ:

- **Page CSP** — No `unsafe-eval`. The `script-src` value varies by target: `build.ts` uses inline script hashes, while `dev.ts`/`start.ts` use `'unsafe-inline'`
- **SW CSP** — Strict: `default-src 'self'; script-src 'self'; connect-src 'self'`. No `unsafe-eval`; SW runtime avoids eval.

On **Cloudflare Pages**, CSP is set per-path in `_headers` (not `/*`) to avoid CF Pages' additive header merging — `/*` would combine with `/sw.js`, and the browser enforces the intersection. Instead, CSP is set individually on `/`, `/index.html`, `/home.html`, `/bangs`, `/bangs.html`, `/bench.html`, `/faq`, `/faq.html`, `/instructions`, `/instructions.html`, and `/sw.js`. Base security headers (without page CSP) still apply under `/*`.

On **self-hosted** (Docker/Railway via `start.ts`), the Bun server sets headers per-request, serving `SW_HEADERS` for `/sw.js` and page headers for everything else.

## Build pipeline

`bun run build` produces `dist/`:

1. **Bundle client scripts** — Bun bundles `src/ui/app.ts`, `src/ui/bench.ts`, `src/ui/bangs.ts`, and `src/ui/theme.ts` into `dist/` (`app.js`, `bench.js`, `bangs.js`, `theme.js`). Entry bundles may split into additional small chunks; chunk fingerprints feed a **`__CACHE_VERSION__`** hash used by the Service Worker precache list.
2. **Bundle Service Worker** — Bun bundles `src/sw/sw.ts` (including `bangs-min.js`) into `dist/sw.js`, with `__CACHE_VERSION__`, `__EXTRA_ASSETS__` (small hashed chunks), and `__IS_DEV__: false` injected at build time.
3. **Generate CSS** — UnoCSS scans `src/**/*.astro` and `src/ui/**/*.ts`, emitting `dist/styles.css`.
4. **Build Astro pages** — `astro build --outDir .astro-build` compiles `src/pages/` and friends into static HTML (e.g. `index.html`, `home.html`, `bangs.html`, `bench.html`, `faq.html`, `instructions.html`).
5. **Inline & minify HTML** — The Astro HTML files are run through a replace that inlines `dist/styles.css` into `<style>` (matching `<link rel="stylesheet" href="/styles.css">` from `SiteLayout`), then minified with `@minify-html/node` and written to `dist/`. The `.astro-build/` directory is removed afterward; `dist/styles.css` is deleted after inlining.
6. **Static copies** — `manifest.json`, `icon.svg`, and a minimal `robots.txt` are written to `dist/`.
7. **`dist/_headers`** — Regenerated with per-route CSP (script hashes from inline `<script>` blocks in the built HTML) plus `Content-Type` for `/opensearch.xml`.
8. **Pre-compress** — Qualifying static assets get Brotli-compressed `.br` siblings. The production server serves `.br` when the client supports it, falling back to uncompressed.

If generated bang artifacts are missing, both `bun run build` and `bun run profile` automatically run `bun run codegen --from-merged` first.

## Frecency

The Service Worker tracks bang usage to personalize suggestion ordering. The flow:

1. **On bang redirect** — `sw.ts` calls `trackBangUsage(trigger)` in `idb.ts`, which increments an in-memory count map and regenerates a compact cookie value (top 8 bangs, format: `g:50.yt:30.w:12`). A fire-and-forget IDB write persists the counts across SW restarts
2. **Cookie sync** — `sw.ts` calls `cookieStore.set()` to write the `sf` cookie with the current frecency value. This happens on every bang redirect
3. **Suggest reads frecency** — `suggest.ts` parses the `sf` cookie (the sole source of frecency) via `parseCookie()` and passes it to `bangSuggestions()`, which boosts candidates by usage count via `effectiveScore()`

The in-memory cache (`frecencyCounts` + preformatted `frecencyCookie` string in `idb.ts`) follows the same pattern as `cachedRedirect` — loaded from IDB once on SW activate, kept in memory for the lifetime of the SW, and reset on `invalidateCache()`.

**Browser cookie behavior**: Chromium-based browsers (Chrome, Edge, Arc) send cookies with suggest requests when the site is the default search engine. Firefox-based browsers (Firefox, Zen, LibreWolf) intentionally withhold cookies from OpenSearch suggest requests as a privacy decision ([bug 1624457](https://bugzilla.mozilla.org/show_bug.cgi?id=1624457)). In those browsers, suggestions fall back to default popularity ranking. Frecency only affects suggestion ordering — it has no effect on redirects.

## Dev server

`bun run dev` runs the dev server with `bun --hot` for soft module reloading:

- **Codegen guard** — If `src/generated/bangs-min.js` is missing, automatically runs `bun run codegen` before the first build
- **Inline builds** — Uses `Bun.build()` for the same four UI entrypoints plus the Service Worker as production, then UnoCSS + **`astro build`** into `.astro-build/`, then CSS inlining and HTML minification into `dist/` (same shape as `build.ts`, with `__IS_DEV__: true` for the SW)
- **File watching** — Watches `src/` recursively via `fs.watch` with 200ms debounce. Any source change triggers a full rebuild
- **Live reload** — SSE endpoint at `/__dev/events` pushes reload events to the browser. A small script is injected into HTML responses that unregisters the Service Worker, clears all caches, and reloads the page on each rebuild
- **Hot reload** — `bun --hot` enables Bun's native hot module reloading for `Bun.serve()`, so the server's fetch handler updates without process restart

## Production server

`bun run start` serves the pre-built `dist/` directory with no build step, file watching, or live reload injection. Useful for testing the production build locally. Requires `bun run build` to have been run first.

## Docker

The Dockerfile uses a multi-stage build to produce a minimal runtime image:

1. **Build stage** — Installs dependencies, runs `codegen --from-merged` to generate bang maps from `data/bangs.json`, then runs `build` to bundle and pre-compress all assets
2. **Runtime stage** — Copies `dist/`, `scripts/start.ts`, and only the source modules needed at runtime for dynamic `/suggest` and `/opensearch.xml` handling (plus generated trie data). Dev dependencies are not installed in the final image

The production server exposes `GET /health`, and the runtime image defines a Docker `HEALTHCHECK` against that endpoint.

```sh
docker build -t flashbang .
docker run -p 3000:3000 flashbang
```

The port is configurable via the `PORT` environment variable:

```sh
docker run -p 8080:8080 -e PORT=8080 flashbang
```

Static assets are served with Brotli pre-compression when the client supports it, falling back to uncompressed. No runtime compression overhead.

## CI

A CI workflow (`.github/workflows/ci.yaml`) runs on every push and pull request to `master`. It runs codegen (`--from-merged`), typecheck, lint/format checks, tests, and a full build to catch issues before merge — no external fetching during CI builds.

A daily cron workflow (`.github/workflows/update-bangs.yaml`) fetches fresh bang sources from DDG and Kagi, merges them, and commits the updated `data/bangs.json` when there are changes.

## Releasing

1. Update `version` in `package.json`
2. Commit: `chore: release vX.Y.Z`
3. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`
4. Push: `git push && git push --tags`

The release workflow (`.github/workflows/release.yaml`) handles the rest:
runs codegen (`--from-merged`), typecheck, lint/format checks, tests, build,
then creates or updates the GitHub Release.

Before pushing the multi-arch image to GHCR, the release workflow builds a local image, runs it, and requires Docker's built-in container health status to become `healthy`.
