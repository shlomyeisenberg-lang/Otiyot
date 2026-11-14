# Otiyot

A 3D Jewish-themed touch-typing adventure (Hebrew and English), shipped as a website and as an Otzaria plugin. Version 1.0.0. It works fully offline: no accounts, no server, no network calls.

You play a young scribe who restores the fading letters of the Land of Letters by typing: two lesson tracks for Hebrew and English, a dozen places with bosses, an endless ladder, practice and challenge modes, sixteen arcade games, statistics, a shop and a full story.

## Commands

Needs Node 20+ and pnpm 10.

- `pnpm install` — install
- `pnpm dev` — run locally
- `pnpm lint` · `pnpm typecheck` · `pnpm test` — checks
- `pnpm test:e2e` — Playwright smoke tests (first run: `pnpm exec playwright install chromium`)
- `pnpm build` — website into `dist/` (relative paths)
- `pnpm build:plugin` — also writes `dist-plugin/otiyot-<version>.otzplugin` and checks it (`pnpm check:plugin`)

## Deploy and release

Import the repo into Vercel; `vercel.json` already sets the build. Every branch gets a preview, `main` is live. Pushing a version tag such as `v1.0.0` runs the release workflow, which attaches the plugin file to a GitHub Release. Install and rollback steps are in `docs/LAUNCH.md`.

## Docs

See `docs/` (ARCHITECTURE, DESIGN, GAME_DESIGN, LAUNCH, ROADMAP), `ASSETS.md`, `CHANGELOG.md` and `ASSUMPTIONS.md`.
