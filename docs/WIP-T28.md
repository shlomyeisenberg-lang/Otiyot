# WIP T28 · The Ladder (endless)

Runner: Otiyot Opus builder. Branch t28-ladder.

## Design (decided)
- Endless spiral climb round a tower of letter blocks above the clouds. Each floor = 3-6 words,
  a random challenge kind drawn from the other scenes' mechanics: steps (Meadow), gale (Hermon wind,
  grip drains faster), lantern (Caves, next word hidden), glass (Scroll, slips cost double, perfect
  floor pays double), long (Rail/Midbar, longer words), swarm (Arena blots knocked off per word).
- Grip meter (like the Caves lantern): right keys feed it, slips cost, drains over time on timed
  difficulties (faster with height, capped). Dyo catches you once per run; next time you fall and the
  run ends. Calm never drains: player ends by Rest (options or landing). Trial: first slip = fall.
- Landing every 5 floors: grip refilled, colour sweep, Rest offered.
- Modifiers chosen before a run: fog, brittle, long, steep; each multiplies score.
- Score per word/floor; high-score table (top 10 per profile) in new save field profile.ladder
  (migration v7->v8).
- Text adaptive: words weighted toward weak keys (weakCharacters), learned letters only.

## Done so far
- (nothing yet)

## Next steps
1. plan.ts (pure) + unit tests  2. save migration  3. scene index.ts + palette.ts  4. screen + route + locales + story lines + music theme
5. e2e smoke test  6. docs/progress
