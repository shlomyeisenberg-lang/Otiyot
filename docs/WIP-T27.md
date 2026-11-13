# WIP T27 (taken over by a manual Fable chat on the new account, 2026-11-13)

Done so far (all pushed; typecheck and lint pass):
- src/game/boss.ts: `erase` option for a phase (the Keeper's last phase).
- src/scenes/scroll/plan.ts: the final as data (5 crossing columns + 4 Keeper phases), allies, typed credits.
- src/scenes/scroll/{index,drawings,palette}.ts: the ScrollScene (parchment strip, 30 pop-up drawings, the white, the archive, the great page, the Keeper, Naftali, Reb Ezra, Dyo, ending cues, credits).
- src/story/scroll.ts: all lines (he + en) and the ending cutscene.
- src/ui/screens/arena.ts: boss screen made generic (BossStage, ally calls, typed credits); src/ui/screens/scroll.ts; route `scroll`; playable.ts.
- locales he/en (scroll.*), credits CSS in arena.css.
- Music sections X1..X3 and K1..K4 were added to the `boss` theme, BUT the unit test "boss plays ten minutes" now times out (too many phases in one theme).

Design decisions:
- The final is ONE boss-kit fight of 9 phases on the arena's boss screen, staged in its own scene.
- After the ending cutscene the credits are typed (words from learned letters), then the results card.
- New Game+ = story flag `ngplus` (no save migration: flags are free-form).

Next steps (in order):
1. Move the scroll's music sections out of `boss` into a new theme `final` (ThemeId, THEME_IDS, locale `sound.theme.final`), use it in the scene; rerun `pnpm test`.
2. Run the scene in Chromium (Playwright), look at screenshots of every phase, the ending and the credits; fix and polish (Xhigh: play it, critique it, improve at least once).
3. Unit tests: tests/unit/scroll.test.ts (plan uses learned letters only, 9 phases, allies alternate, credit words learned; boss `erase` cap and weak-point reset). e2e: tests/e2e/scroll.spec.ts (model: tests/e2e/trials.spec.ts).
4. Docs: ARCHITECTURE, GAME_DESIGN ("built in T27"), ROADMAP tick, CHANGELOG, progress.json (done, changes, decisions, todo), render-progress.
5. lint, typecheck, test, build; PR; CI; squash-merge; remove the claim in state.json; email.
