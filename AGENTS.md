# Agent instructions — Flashbang

Context for AI coding agents working in this repository.

## What this project is

**Flashbang** (`ban.gs`) is a privacy-oriented, local-first **bang redirect** app: users type triggers like `!w cats` and get routed to the right search/site URL. Core behavior lives in a **Service Worker** (`src/sw/`), with UI and settings in `src/ui/` and optional **Astro** pages under `src/pages/` / `src/components/` / `src/layouts/`.

Production bundles are produced by **Bun** scripts (`scripts/build.ts`), not only Astro. Cloudflare Pages deploy uses `dist/` from that pipeline (`wrangler pages deploy dist`).

## Prerequisites

- **[Bun](https://bun.sh)** — runtime, package manager, and bundler for the main app.

## Commands agents should use

| Goal                                                                       | Command             |
| -------------------------------------------------------------------------- | ------------------- |
| Install deps                                                               | `bun install`       |
| Lint + format (must pass)                                                  | `bun run check`     |
| Auto-fix lint/format                                                       | `bun run fix`       |
| Typecheck                                                                  | `bun run typecheck` |
| Unit tests                                                                 | `bun test`          |
| Full prod build (runs codegen from merged data if generated files missing) | `bun run build`     |
| Dev server (watch + live reload; codegen if needed)                        | `bun run dev`       |
| E2E (build + Playwright)                                                   | `bun run test:e2e`  |

After substantive edits, prefer **`bun run check`** and **`bun test`** at minimum; run **`bun run build`** when touching bundling, SW, headers, or codegen-related paths.

**Bang data / codegen:** `bun run codegen` fetches DDG/Kagi sources and regenerates merged data and `src/generated/*`. CI uses **`bun run codegen --from-merged`** (no network). Do **not** hand-edit files under `src/generated/` — regenerate via codegen.

**Astro:** `bun run build:astro` builds static Astro output to `.astro-build/`. This is separate from the primary `bun run build` pipeline; confirm which surface you are changing.

## Layout (where to look)

- **`scripts/`** — `dev.ts`, `build.ts`, `codegen.ts`, `start.ts`, `profile.ts`
- **`src/sw/`** — Service Worker: redirects, caching, frecency (`idb.ts`, `frecency.ts`)
- **`src/ui/`** — Client app: `app.ts`, settings, suggest cookies, HTML templates, PWA assets
- **`src/shared/`** — Shared utilities (trie, templates, raw URL/query parsing)
- **`src/server/`** — `handlers.ts`, **`headers.ts`** (CSP and security headers — single source of truth conceptually; see `DEVELOPMENT.md` for Pages vs Docker nuances)
- **`src/suggest*.ts`**, **`src/opensearch.ts`** — Suggest behavior and OpenSearch XML generation
- **`functions/`** — Cloudflare Pages Functions (`suggest`, `opensearch.xml`)
- **`data/`** — `bangs.json` (merged, committed), `custom-bangs.json`; fetched upstream JSON is gitignored
- **`tests/`** — Unit tests; **`tests/e2e/`** — Playwright

Long-form explanations (CSP, frecency, Docker, CI, release): **`DEVELOPMENT.md`**.

## Conventions

- **TypeScript:** `strict` enabled; respect existing patterns (imports, naming, minimal commenting).
- **Lint/format:** **Biome** (`biome.jsonc`). Use `bun run check` / `bun run fix`.
- **CSS:** UnoCSS (`uno.config.ts`); CLI scans Astro and TS/HTML as configured in scripts.
- **Scope:** Match the smallest change that satisfies the task; avoid unrelated refactors.

## CI expectations

GitHub Actions runs codegen `--from-merged`, typecheck, Biome, tests, and a full build without fetching bang sources from the network. Changes should keep that workflow green.

## User-facing copy / versioning

- Release and version bumps follow `DEVELOPMENT.md` (“Releasing”).
- Avoid awkward symbols or markdown that breaks product UI unless the design explicitly requires it.

When in doubt about behavior or deployment details, read **`DEVELOPMENT.md`** before guessing.
