# T14 Home Row Meadow: hand-over note (delete this file in the final commit)

Branch `t14-meadow`. Written by the Fable runner on 2026-11-11 so another run can finish if this one stops.

## Done and working (all pushed)
- `src/scenes/meadow/` : `index.ts` (the scene), `plan.ts` (pure run plan, tested), `palette.ts`, `flyers.ts` (birds, butterflies).
- `src/story/meadow.ts` : Reb Ezra and Dyo lines (he/en).
- `src/ui/screens/meadow.ts` + `src/ui/styles/meadow.css` : the screen, route `meadow` (app.ts, shell.ts), `SCENE_ROUTES.meadow` in `src/ui/playable.ts`, locale keys `meadow.*` in both files.
- `tests/unit/meadow.test.ts` (12 tests pass), `tests/e2e/meadow.spec.ts` (2 tests pass locally; in the sandbox run Playwright with a config that sets `launchOptions.executablePath` to the pre-installed Chromium under /opt/pw-browsers).
- Checked by screenshot: lesson view, mid-run view, finale and results card, English and Hebrew, light and dark. About 87 draw calls and 99k triangles on medium. No GPU leak.

## Still to do
1. Look at a 375px-wide screenshot and the compact results card once more; fix anything that overlaps.
2. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (typecheck, eslint and the new tests already pass; the full run was not repeated after the last edits).
3. Docs: add section "7h. Home Row Meadow (T14)" to docs/ARCHITECTURE.md (scene, plan, screen, the run pattern other scenes copy), a line in CHANGELOG.md, tick T14 in docs/ROADMAP.md.
4. docs/progress.json T14 entry (status, pr, summary, changes, decisions, todo), run `node scripts/render-progress.mjs`, commit both.
5. Delete this file, open the PR into main, wait for checks, squash-merge, delete the branch, clear the claim in state.json, send the "Otiyot T14 done" email, then chain to the next owner (T15 is Sonnet's).

## Decisions to record in progress.json
- No attacking enemies and no timers on any difficulty: the Meadow is the tutorial; the "enemy" is the grey itself, lifting as mist. Difficulty changes word length, how much a slip costs the streak, the speed for rank S; Sofer's Trial ends at the first slip (not recorded as restored).
- The garden is eight beds laid out like the home-row keys, colored by finger, with gold studs on the two index beds; only learned letters are shown on the stones.
- Flowers are always in color (red on grey), the ground turns green in rings from the garden, one ring per word (rings share one centre so the engine's six sweep slots are enough).
- Reb Ezra's lesson runs on the first visit; Esc skips it; afterwards it is a choice in "Level and difficulty".
- Runs are statistics-only history entries `scene:meadow:<level>:<difficulty>`; rewards are shown but not added to a wallet (T33).
- First 3D screen benchmark is run here too when quality is auto.
- Enter on the results card goes back to the house after the first restoration, otherwise plays again.
