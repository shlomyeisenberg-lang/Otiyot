# WIP T24 · The Long Midbar

Done so far:
- src/scenes/midbar/plan.ts (trek + storm sentence per stage, Gust, March, lookahead, sight)
- src/story/midbar.ts, locales (midbar.*), audio: midbar theme, sand ambience, gust + camel-bell sfx
- route wiring (app.ts, playable.ts, shell.ts), screen src/ui/screens/midbar.ts (copied from station, adapted), CSS veil

Next steps:
- src/scenes/midbar/palette.ts + index.ts (MidbarScene)
- tests/unit/midbar.test.ts, tests/e2e/midbar.spec.ts
- screenshots, docs (ARCHITECTURE 7q, CHANGELOG, ROADMAP tick), progress.json, PR

Decisions:
- Pattern: Star Station split (sentences band), gusts like its rocks; storm sentences hide the lookahead (0 words on Standard/Hard, 1 on Easy), HUD next word blurred via data-veil.
