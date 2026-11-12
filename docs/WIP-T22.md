# WIP T22 · The Star Station (Opus builder)

## Design (decided)
- Files: src/scenes/station/{plan,palette,index}.ts, src/ui/screens/station.ts, src/story/station.ts,
  audio theme `station` (new melody voice `glass`, bpm 66) + sfx `thrust`, `laser`; route/shell/playable;
  tests/unit/station.test.ts, tests/e2e/station.spec.ts; docs, locales, CHANGELOG.
- Run = modules (easy 3, standard 4, hard 4). Each module = two sentences: a DRIFT leg (the
  sentence fires the thrusters, the apprentice floats along an arc to the module's top hatch;
  no timer) then a TURRET leg (one debris rock per word drifts in at the module; finishing the
  word fires the turret; Calm: rocks hold and wait; else a rock that reaches the hull strikes:
  streak drops, it bounces back and comes in slower).
- Sentences built from learned words; capital first letter / full stop only if learned.
- Stars: every word lights more stars (drawRange on a Points cloud); finale: dome opens,
  constellations drawn, planet below restored.

## Done so far
- plan.ts + unit tests (26 pass), story lines, palette, scene index.ts (first pass), screen, routes, audio theme `station` (glass voice, 3/4 at 66) + sfx thrust/laser, locales.

## Next steps
- Done: look passes 1-3 (sky rides with camera inside far plane, planet curve, low debris line, observatory side debris, finale wide shot with constellations), e2e spec passes locally.
- Next: sound.spec count 10->11; docs (ARCHITECTURE 7o, GAME_DESIGN row, CHANGELOG), ROADMAP tick, progress.json.
