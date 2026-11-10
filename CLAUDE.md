# Otiyot — project rules

Otiyot is a 3D Jewish-themed touch-typing adventure (Hebrew + English), shipped as a static website and as an Otzaria plugin. The owner is not a developer: explain in plain words.

## Before coding
- Read `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, and your task in `docs/ROADMAP.md`. Read `docs/GAME_DESIGN.md` if the task touches story, scenes or gameplay.
- One task per chat, one branch per task, started from the latest `main`.
- Keep changes inside the task. Other ideas go to ROADMAP "Later" or `feature_ideas` in the progress log.

## Save tokens (this matters to the owner)
- Open only the files the task names plus what you must touch. Use Grep before Read.
- Never read `reference/**/three.min.js`, `pnpm-lock.yaml`, `docs/progress.json` in full, or `docs/PROGRESS.md`. For progress.json read only your own task entry (e.g. with `node -e`).
- `reference/` is large. Read only the specific file your task ports, in parts.
- For bulk mechanical work inside a task (word lists, translating strings, repetitive test cases) you may hand it to a helper agent on a cheaper model (Haiku) with a tight brief, then check its output.

## Code rules
- TypeScript strict, no `any`. No runtime network requests. No secrets exist in this project.
- `src/core`, `src/learn`, `src/save` are pure logic: no DOM, no Three.js, fully unit-tested.
- Scenes implement `GameScene` and use only the kits in `src/engine`, `src/audio`, `src/game`, `src/ui`. A scene never reads the keyboard or the save directly, and disposes everything it creates.
- UI: tokens and components from DESIGN only; every string in `locales/he.json` and `locales/en.json`; logical CSS properties so RTL works.
- Saves: every schema change is a new migration with a test. Never store typed text.
- `reference/` is read-only. `public/arcade/` legacy code is changed only by the arcade tasks.
- Content rules in ARCHITECTURE section 8 are binding: **no women and nothing sexy anywhere** (all human characters male, no suggestive content in visuals, text or word lists), family-safe, modest, no holy Names, no pesukim as typing text.
- **Learned letters only**: all text to type uses only keys the active profile has already learned in its lesson track. Every scene has levels (Easy / Standard / Hard) built from the learned set and unlocks by course progress. See GAME_DESIGN 'Levels follow your learning'. Add a unit test for this in every task that produces typing text.
- Performance budgets in ARCHITECTURE section 7. No allocations inside `update()`.
- No gameplay placeholders. Anything unfinished is listed in `todo` in the progress log.
- Every asset or font added is listed in `ASSETS.md` with source and licence. User-visible changes go in `CHANGELOG.md`.

## Before finishing
- Unit tests for logic; one Playwright smoke test for each new scene or screen.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass.
- Update the docs you changed the truth of. Tick the task in ROADMAP.md.
- Update the progress log (below), push, open a PR, wait for CI, squash-merge it yourself, delete the branch.
- Then tell the owner in 3–5 plain bullets: what was built, how to try it on the live link, what he must do.

## Progress log
`docs/progress.json` is shared; `docs/PROGRESS.md` is generated from it by `node scripts/render-progress.mjs` (never edit PROGRESS.md by hand). Each task edits only its own entry and appends to shared lists, then runs the script and commits both files in the same PR.
- `status`: `pending` → `in_progress` → `done` (only once merged) or `blocked`. Also `finished` (date), `pr` (URL), `summary` (one plain sentence).
- `changes`: everything built. `decisions`: every choice made without asking, each `{decision, why}`.
- `manual_steps`: each step only the owner can do: `{title, details, browser_prompt, done}`. The `browser_prompt` is self-contained for Claude in Chrome: names the site and URL, exact steps, stops and hands back for sign-in, passwords, 2FA, CAPTCHAs, payment and creating accounts, reports what it did.
- `todo`, `notes`. Top-level `feature_ideas`: only useful ones, each `{from, title, why, model, effort, prompt}` with a full task prompt on branch `idea-<name>`.
- On a merge conflict keep both sides of the JSON and regenerate PROGRESS.md.

## Commands
`pnpm dev` · `pnpm build` · `pnpm build:plugin` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e` · `node scripts/render-progress.mjs`
