# Agent instructions — bangs.to

Context for AI coding agents working in this repository.

## What this project is

**bangs.to** is a privacy-oriented, local-first **bang redirect** app: users type triggers like `!w cats` and get routed to the right search/site URL. The current public site title/brand is **`bangs.to`**, configured in [`src/config/site.ts`](src/config/site.ts). Core behavior lives in a **Service Worker** (`src/sw/`), with shared client/runtime code in `src/ui/` and the site shell/pages generated from **Astro** in `src/pages/`, `src/components/`, and `src/layouts/`. The app also includes a local stats dashboard (`/stats`) backed by browser storage and the frecency snapshot.

Production bundles are produced by **pnpm-managed Node scripts** (`scripts/build.ts`), not only Astro. Cloudflare Pages deploy uses `dist/` from that pipeline (`wrangler pages deploy dist`).

## Prerequisites

- **[pnpm](https://pnpm.io/)** — package manager used for installs and scripts
- **Node.js 24+** — runtime for the custom build/dev/start/codegen scripts

## Commands agents should use

| Goal                                                                       | Command             |
| -------------------------------------------------------------------------- | ------------------- |
| Install deps                                                               | `pnpm install`       |
| Lint + format (must pass)                                                  | `pnpm run check`     |
| Auto-fix lint/format                                                       | `pnpm run fix`       |
| Typecheck                                                                  | `pnpm run typecheck` |
| Unit tests                                                                 | `pnpm test`          |
| Full prod build (runs codegen from merged data if generated files missing) | `pnpm run build`     |
| Dev server (watch + live reload; codegen if needed)                        | `pnpm run dev`       |
| Performance profiling                                                      | `pnpm run profile`   |
| E2E (build + Playwright)                                                   | `pnpm run test:e2e`  |

After substantive edits, prefer **`pnpm run check`** and **`pnpm test`** at minimum; run **`pnpm run build`** when touching bundling, SW, headers, or codegen-related paths.

**Bang data / codegen:** `pnpm run codegen` fetches DDG/Kagi sources and regenerates merged data and `src/generated/*`. CI uses **`pnpm run codegen --from-merged`** (no network). Do **not** hand-edit files under `src/generated/` — regenerate via codegen.

**Astro:** `pnpm run build:astro` builds static Astro output to `.astro-build/`. This is separate from the primary `pnpm run build` pipeline; confirm which surface you are changing.

**Branding:** If a task asks to rename the site or change its visible title, update [`src/config/site.ts`](src/config/site.ts) first, then review metadata outputs such as the manifest and OpenSearch descriptors.

## Layout (where to look)

- **`scripts/`** — `dev.ts`, `build.ts`, `codegen.ts`, `start.ts`, `profile.ts`
- **`src/sw/`** — Service Worker: redirects, caching, frecency (`idb.ts`, `frecency.ts`)
- **`src/ui/`** — Client runtime: `app.ts`, `stats.ts`, settings, bang browser logic, suggest cookies, PWA assets
- **`src/config/`** — Shared site-level config such as title and tagline
- **`src/pages/`** — Astro routes (`/`, `/home`, `/bangs`, `/stats`, `/contact`, `/faq`, `/instructions`)
- **`src/components/`** — Shared Astro UI (`TopBar`, `TrySearch`, `SettingsModal`, etc.)
- **`src/layouts/`** — Shared Astro layout shell
- **`src/shared/`** — Shared utilities (trie, templates, raw URL/query parsing)
- **`src/server/`** — `handlers.ts`, **`headers.ts`** (CSP and security headers — single source of truth conceptually; see `DEVELOPMENT.md` for Pages vs Docker nuances)
- **`src/suggest*.ts`**, **`src/opensearch.ts`** — Suggest behavior and OpenSearch XML generation
- **`functions/`** — Cloudflare Pages Functions (`suggest.ts`, `opensearch.xml.ts`)
- **`data/`** — `bangs.json` (merged, committed), `custom-bangs.json`; fetched upstream JSON is gitignored
- **`tests/`** — Unit tests; **`tests/e2e/`** — Playwright

Long-form explanations (CSP, frecency, Docker, CI, release): **`DEVELOPMENT.md`**.

## Conventions

- **TypeScript:** `strict` enabled; respect existing patterns (imports, naming, minimal commenting).
- **Lint/format:** **Biome** (`biome.jsonc`). Use `pnpm run check` / `pnpm run fix`.
- **CSS:** UnoCSS (`uno.config.ts`); CLI scans Astro and TS/HTML as configured in scripts.
- **Routing/UI:** The site uses a shared Astro top bar/footer and a shared settings modal. The settings modal is route-addressable via page-specific `#settings` URLs such as `/#settings` and `/faq#settings`.
- **Stats data:** The stats page is local-first and reads browser storage via the frecency snapshot in `src/sw/frecency.ts` / `src/sw/idb.ts`. Keep changes privacy-preserving and device-local unless the task explicitly says otherwise.
- **Scope:** Match the smallest change that satisfies the task; avoid unrelated refactors.

## CI expectations

GitHub Actions runs codegen `--from-merged`, typecheck, Biome, tests, and a full build without fetching bang sources from the network. Changes should keep that workflow green.

## User-facing copy / versioning

- Release and version bumps follow `DEVELOPMENT.md` (“Releasing”).
- Avoid awkward symbols or markdown that breaks product UI unless the design explicitly requires it.

When in doubt about behavior or deployment details, read **`DEVELOPMENT.md`** before guessing.
