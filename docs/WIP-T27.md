# WIP T27 (taken over by a manual Fable chat on the new account, 2026-11-13)

Done so far:
- src/game/boss.ts: `erase` option for a phase (the Keeper's last phase).
- src/scenes/scroll/plan.ts: the whole final as data (5 crossing columns + 4 Keeper phases), allies, typed credits.

Design decisions:
- The final is ONE boss-kit fight of 9 phases, run by the arena's boss screen (made generic over a "stage" scene), in a new scene src/scenes/scroll (ScrollScene).
- After the ending cutscene the credits are typed (words from learned letters), then the results card. New Game+ = story flag `ngplus`.

Next steps (in order):
1. src/story/scroll.ts (lines, ending cutscene, credits lines)
2. src/scenes/scroll/index.ts (the scene)
3. src/ui/screens/arena.ts: BossStage interface, stage loader, credits; src/ui/screens/scroll.ts; route `scroll`; playable.ts
4. music sections in src/audio/themes.ts (cross1..3, keeper1..4)
5. locales he/en, CSS, unit tests (plan learned-letters, erase), e2e tests/e2e/scroll.spec.ts
6. docs: ARCHITECTURE, GAME_DESIGN, ROADMAP tick, CHANGELOG, progress.json
