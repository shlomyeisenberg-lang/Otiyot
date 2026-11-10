# Otiyot

A 3D Jewish-themed touch-typing adventure (Hebrew and English), shipped as a website and as an Otzaria plugin.

## Commands

Needs Node 20+ and pnpm 10.

- `pnpm install` — install
- `pnpm dev` — run locally
- `pnpm lint` · `pnpm typecheck` · `pnpm test` — checks
- `pnpm test:e2e` — Playwright smoke tests (first run: `pnpm exec playwright install chromium`)
- `pnpm build` — website into `dist/` (relative paths)
- `pnpm build:plugin` — also writes `dist-plugin/otiyot-<version>.otzplugin`

## Deploy

Import the repo into Vercel; `vercel.json` already sets the build. Every branch gets a preview, `main` is live.

## Docs

See `docs/` (ARCHITECTURE, DESIGN, GAME_DESIGN, ROADMAP) and `ASSUMPTIONS.md`.
