# WIP T26 · The Silent Arena: remaining bosses (Opus builder)

## Plan
- `src/game/boss.ts`: phase options `pace` (faster attacks), `rest` (pause after a parry = bursts), `heal` (errors heal the boss), `tide` (windup speed rises and falls). New attacks `dash`, `prism`, `wave`. `BossFight.slip()`, `tide`, `healed`.
- `src/scenes/arena/trials.ts` (pure): three bosses — Lightning (speed, bursts), Glass (precision, slips heal it), Long Tide (endurance, long passages, shifting tides). 3 phases each, sizes per level, learned letters only.
- `src/game/trials.ts` (pure): rank per boss in `story.ranks['trial:<id>']`; the Arena region is restored once all three are beaten (its rank = the lowest).
- Scene `src/scenes/arena`: `ArenaSetup.boss` picks the creature (drop / comet / crystal / whale), lights, grades, attacks.
- Music: three new boss themes.
- Screens: `arena.ts` becomes a generic boss-fight screen (Blot config + trial config); new `#/trials` board (three cards, rank seals) and `#/trial` fight. `SCENE_ROUTES.arena = 'trials'`.
- Story lines + victory cutscenes in `src/story/trials.ts`. i18n en/he.
- Tests: unit (boss kit, planners, ranks), e2e `tests/e2e/trials.spec.ts`.

## Done so far
- (nothing yet)

## Next steps
- boss kit
