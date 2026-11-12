# Otiyot — task prompts for the scheduled builders

Three scheduled tasks build this list while nobody watches: **"Otiyot Opus builder"**, **"Otiyot Sonnet builder"** and **"Otiyot Fable builder"**. They work strictly in the order below. Each builds only the tasks whose OWNER is its own model, and passes the baton to the owner of the next task when it finishes.

**Rules for every task (from the owner):** (1) No women and nothing sexy anywhere: every human character is male, nothing suggestive in visuals, text, jokes or word lists. (2) Text to type uses only letters the player has already learned in their lesson track, and every scene has levels (Easy / Standard / Hard) built from that learned set and unlocked by course progress. Details: CLAUDE.md, ARCHITECTURE section 8, GAME_DESIGN 'Levels follow your learning'.

Owner rule: Fable builds four tasks that need the most taste and skill: the Home Row Meadow that sets the pattern for all scenes (T14), the boss kit (T16), the final Keeper fight (T27) and the polish pass (T34). Opus builds everything else that was planned as Fable: the foundations (T07 to T13), the remaining scenes (T20 to T26, T28) and progression (T33). Sonnet builds everything that was planned as Sonnet: setup, saves, lessons, the first scenes already built by it (T15, T17 to T19), arcade, modes, stats, story text, packaging.

Effort guide: Low = quick and direct · Medium = normal care · High = think the design through before building, test edge cases · Xhigh = plan, build, then play it and critique it yourself and improve at least once before merging.

| Task | Owner | Effort | Branch | Title |
| --- | --- | --- | --- | --- |
| T01 | Sonnet | Medium | `t01-setup` | Project setup, CI and plugin packer |
| T02 | Sonnet | High | `t02-typing-core` | Typing core |
| T03 | Sonnet | Medium | `t03-saves` | Saves and profiles |
| T04 | Sonnet | Medium | `t04-lesson-tracks` | The two lesson tracks |
| T05 | Sonnet | Medium | `t05-word-library` | Word and sentence library |
| T06 | Sonnet | High | `t06-adaptive` | Adaptive engine and spaced repetition |
| T07 | Opus | High | `t07-design-system` | Design system and UI shell |
| T08 | Opus | Xhigh | `t08-engine-kit` | 3D engine kit |
| T09 | Opus | High | `t09-keyboard-hud` | 3D keyboard, finger guide, HUD and typing feedback |
| T10 | Opus | High | `t10-audio` | Audio engine and first music themes |
| T11 | Opus | High | `t11-combat-kit` | Combat, combo and difficulty kit |
| T12 | Opus | High | `t12-story-title` | Story system, title screen and intro |
| T13 | Opus | High | `t13-hub` | Hub: the House of the Scribe |
| T14 | Fable | High | `t14-meadow` | Scene: Home Row Meadow |
| T15 | Sonnet | High | `t15-cliffs` | Scene: Cliffs of Ein Gedi |
| T16 | Fable | Xhigh | `t16-boss-kit` | Boss kit and the first boss |
| T17 | Sonnet | High | `t17-forge` | Scene: The Gematria Forge |
| T18 | Sonnet | High | `t18-shuk` | Scene: The Night Shuk |
| T19 | Sonnet | High | `t19-rail` | Scene: The Jaffa Line |
| T20 | Opus | High | `t20-geniza` | Scene: The Sunken Geniza |
| T21 | Opus | High | `t21-hermon` | Scene: Wings over Hermon |
| T22 | Opus | High | `t22-station` | Scene: The Star Station |
| T23 | Opus | High | `t23-atbash` | Scene: Atbash City |
| T24 | Opus | High | `t24-midbar` | Scene: The Long Midbar |
| T25 | Opus | High | `t25-caves` | Scene: The Lantern Caves |
| T26 | Opus | High | `t26-arena-bosses` | The Silent Arena: remaining bosses |
| T27 | Fable | Xhigh | `t27-final` | The Blank Scroll and the Keeper |
| T28 | Opus | Medium | `t28-ladder` | Scene: The Ladder (endless) |
| T29 | Sonnet | High | `t29-arcade-classics` | Arcade: host and the 3D classics |
| T30 | Sonnet | Medium | `t30-arcade-newgen` | Arcade: new-generation and quick games |
| T31 | Sonnet | Medium | `t31-modes` | Modes: Practice, Time Attack, Survival, Daily |
| T32 | Sonnet | Medium | `t32-dashboard-journal` | Statistics dashboard and journal |
| T33 | Opus | Medium | `t33-progression` | Progression, abilities, shop and cosmetics |
| T34 | Fable | Xhigh | `t34-polish-pass` | Art, lighting, VFX and music pass |
| T35 | Sonnet | High | `t35-story-full` | Full story: cutscenes and voice |
| T36 | Sonnet | Medium | `t36-settings-a11y` | Settings, accessibility and health |
| T37 | Sonnet | Medium | `t37-ghosts` | Ghosts and local leaderboards |
| T38 | Sonnet | High | `t38-perf-tests` | Performance pass and full smoke tests |
| T39 | Sonnet | Medium | `t39-release` | Release: website and Otzaria plugin 1.0 |

## T01 · Project setup, CI and plugin packer

Owner: **Sonnet** · Effort: **Medium** · Branch: `t01-setup`

Done when: CI is green, `pnpm dev` shows the boot screen, and the plugin file is produced.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T01: Project setup, CI and plugin packer (branch: t01-setup)
Goal: A running empty project that builds as a website and as an Otzaria plugin, with checks on every pull request.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T01 in docs/ROADMAP.md. Only open the code files this task needs (start with: reference/plugin-4.2.0/manifest.json, reference/plugin-4.2.0/index.html).
2. Start from the latest main and create the branch t01-setup.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T01 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T02 · Typing core

Owner: **Sonnet** · Effort: **High** · Branch: `t02-typing-core`

Done when: Unit tests cover scoring, layout mapping and a recorded session for both layouts.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T02: Typing core (branch: t02-typing-core)
Goal: The pure-logic typing engine every scene and mode will use.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T02 in docs/ROADMAP.md. Only open the code files this task needs (start with: reference/plugin-4.2.0/js/typing-engine.js, reference/plugin-4.2.0/js/constants.js).
2. Start from the latest main and create the branch t02-typing-core.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T02 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T03 · Saves and profiles

Owner: **Sonnet** · Effort: **Medium** · Branch: `t03-saves`

Done when: Tests prove round-trip, migration from an older version, recovery from a corrupt save, and both adapters (Otzaria mocked).

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T03: Saves and profiles (branch: t03-saves)
Goal: Reliable local saves with several profiles, in the browser and inside Otzaria.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T03 in docs/ROADMAP.md. Only open the code files this task needs (start with: reference/plugin-4.2.0/js/storage.js).
2. Start from the latest main and create the branch t03-saves.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T03 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T04 · The two lesson tracks

Owner: **Sonnet** · Effort: **Medium** · Branch: `t04-lesson-tracks`

Done when: Both tracks produce the same lesson content as their originals, for Hebrew and English, and switching tracks works in tests.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T04: The two lesson tracks (branch: t04-lesson-tracks)
Goal: Both built-in courses, selectable per profile: Track 1 from plugin 3.3.0 and Track 2 from plugin 4.2.0.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T04 in docs/ROADMAP.md. Only open the code files this task needs (start with: reference/plugin-3.3.0/js/lessons.js, reference/plugin-4.2.0/js/lessons.js, the LEVELS and key-order parts of each constants.js).
2. Start from the latest main and create the branch t04-lesson-tracks.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T04 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T05 · Word and sentence library

Owner: **Sonnet** · Effort: **Medium** · Branch: `t05-word-library`

Done when: At least 3,000 Hebrew and 3,000 English words plus 300 sentences each, all passing the content test; filter API unit-tested.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T05: Word and sentence library (branch: t05-word-library)
Goal: A large built-in library of words and sentences by difficulty tier, with Jewish-themed packs, plus custom lists.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T05 in docs/ROADMAP.md. Only open the code files this task needs (start with: reference/plugin-4.2.0/js/lexicon.js).
2. Start from the latest main and create the branch t05-word-library.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T05 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T06 · Adaptive engine and spaced repetition

Owner: **Sonnet** · Effort: **High** · Branch: `t06-adaptive`

Done when: Given a simulated weak-key profile, generated drills over-sample the weak keys within set bounds, and review dates advance correctly in tests.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T06: Adaptive engine and spaced repetition (branch: t06-adaptive)
Goal: Drills that lean on the player's weak keys while keeping flow, with scheduled review.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T06 in docs/ROADMAP.md. Only open the code files this task needs (start with: reference/plugin-4.2.0/js/adaptive.js, reference/plugin-4.2.0/js/pedagogy.js).
2. Start from the latest main and create the branch t06-adaptive.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T06 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T07 · Design system and UI shell

Owner: **Opus** · Effort: **High** · Branch: `t07-design-system`

Done when: Menus are beautiful and usable in both languages and themes at 1366×768 and 375px; a new profile can be created with a track and layout.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T07: Design system and UI shell (branch: t07-design-system)
Goal: Turn DESIGN.md into real tokens, fonts and components, with Hebrew RTL and English LTR, and the menu shell.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T07 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/DESIGN.md).
2. Start from the latest main and create the branch t07-design-system.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T07 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T08 · 3D engine kit

Owner: **Opus** · Effort: **Xhigh** · Branch: `t08-engine-kit`

Done when: The test range runs at 60 fps on medium, shows every effect and animation, and leaves zero leaked GPU objects after dispose (test).

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T08: 3D engine kit (branch: t08-engine-kit)
Goal: The reusable 3D foundation every scene is built on, tuned for integrated graphics.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T08 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/DESIGN.md (3D art direction), docs/ARCHITECTURE.md sections 2 and 7).
2. Start from the latest main and create the branch t08-engine-kit.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T08 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T09 · 3D keyboard, finger guide, HUD and typing feedback

Owner: **Opus** · Effort: **High** · Branch: `t09-keyboard-hud`

Done when: In the test range a full lesson can be typed in Hebrew and English with satisfying feedback, correct RTL, and the finger guide always showing the next key (also right after an error).

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T09: 3D keyboard, finger guide, HUD and typing feedback (branch: t09-keyboard-hud)
Goal: The moment-to-moment feel of typing: what the player sees and feels on every key.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T09 in docs/ROADMAP.md. Only open the code files this task needs (start with: src/core (public API), src/engine/scene.ts).
2. Start from the latest main and create the branch t09-keyboard-hud.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T09 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T10 · Audio engine and first music themes

Owner: **Opus** · Effort: **High** · Branch: `t10-audio`

Done when: Each theme is distinct and pleasant for 10 minutes, stems audibly build with the combo, and volumes work.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T10: Audio engine and first music themes (branch: t10-audio)
Goal: Procedural sound that makes typing feel musical.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T10 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/DESIGN.md (Sound direction)).
2. Start from the latest main and create the branch t10-audio.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T10 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T11 · Combat, combo and difficulty kit

Owner: **Opus** · Effort: **High** · Branch: `t11-combat-kit`

Done when: A sandbox wave fight in the test range is fun on all five difficulties and ends with a results screen.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T11: Combat, combo and difficulty kit (branch: t11-combat-kit)
Goal: Word-shield enemies and the combo system shared by all action scenes.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T11 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (Combat, Progression)).
2. Start from the latest main and create the branch t11-combat-kit.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T11 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T12 · Story system, title screen and intro

Owner: **Opus** · Effort: **High** · Branch: `t12-story-title`

Done when: From launch: title → new game → intro cutscene plays, can be skipped, and hands over to the hub.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T12: Story system, title screen and intro (branch: t12-story-title)
Goal: In-engine cutscenes and dialogue, the title screen, and the opening of the story.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T12 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (Story, Characters)).
2. Start from the latest main and create the branch t12-story-title.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T12 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T13 · Hub: the House of the Scribe

Owner: **Opus** · Effort: **High** · Branch: `t13-hub`

Done when: The player can walk the hub by typing, start any unlocked scene, and the hub visibly gains color as regions are restored.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T13: Hub: the House of the Scribe (branch: t13-hub)
Goal: A living home base that works as the game's menu.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T13 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md).
2. Start from the latest main and create the branch t13-hub.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T13 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T14 · Scene: Home Row Meadow

Owner: **Fable** · Effort: **High** · Branch: `t14-meadow`

Done when: The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T14: Scene: Home Row Meadow (branch: t14-meadow)
Goal: Build the "Home Row Meadow" scene as a distinct, beautiful, exciting 3D level whose mechanic is: a gentle guided tutorial where typing home-row letters restores flowers, grass and birdsong; Reb Ezra teaches hand placement through play in the first five minutes; skippable
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T14 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (scene table), src/engine/scene.ts, one existing scene folder as a pattern).
2. Start from the latest main and create the branch t14-meadow.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T14 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T15 · Scene: Cliffs of Ein Gedi

Owner: **Sonnet** · Effort: **High** · Branch: `t15-cliffs`

Pattern rule (this task was moved to Sonnet to save cost): do not invent a new look. Open the finished Home Row Meadow scene (src/scenes/meadow, T14) and the engine kit, copy their structure, lighting quality and feel, and take screenshots with Playwright to compare your scene against the Meadow before merging. Make your scene clearly different in palette, weather, mechanic and music, but equally polished.

Done when: The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T15: Scene: Cliffs of Ein Gedi (branch: t15-cliffs)
Goal: Build the "Cliffs of Ein Gedi" scene as a distinct, beautiful, exciting 3D level whose mechanic is: stepping stones over a canyon where top-row words make the scribe reach up and bottom-row words reach down; waterfalls restart as sections are restored
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T15 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (scene table), src/engine/scene.ts, one existing scene folder as a pattern).
2. Start from the latest main and create the branch t15-cliffs.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T15 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T16 · Boss kit and the first boss

Owner: **Fable** · Effort: **Xhigh** · Branch: `t16-boss-kit`

Done when: The boss fight is winnable on every difficulty, each phase feels different, and transitions are cinematic. Phase 1 slice is complete: title → hub → two scenes → boss → save/load.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T16: Boss kit and the first boss (branch: t16-boss-kit)
Goal: The multi-phase boss framework and a first boss that is the dramatic peak of the slice.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T16 in docs/ROADMAP.md. Only open the code files this task needs (start with: src/game (combat kit API), docs/GAME_DESIGN.md (Combat)).
2. Start from the latest main and create the branch t16-boss-kit.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T16 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T17 · Scene: The Gematria Forge

Owner: **Sonnet** · Effort: **High** · Branch: `t17-forge`

Pattern rule (this task was moved to Sonnet to save cost): do not invent a new look. Open the finished Home Row Meadow scene (src/scenes/meadow, T14) and the engine kit, copy their structure, lighting quality and feel, and take screenshots with Playwright to compare your scene against the Meadow before merging. Make your scene clearly different in palette, weather, mechanic and music, but equally polished.

Done when: The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T17: Scene: The Gematria Forge (branch: t17-forge)
Goal: Build the "The Gematria Forge" scene as a distinct, beautiful, exciting 3D level whose mechanic is: typing numbers (and letter values) keeps the furnace temperature in the safe band while the smith forges letters
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T17 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (scene table), src/engine/scene.ts, one existing scene folder as a pattern).
2. Start from the latest main and create the branch t17-forge.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T17 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T18 · Scene: The Night Shuk

Owner: **Sonnet** · Effort: **High** · Branch: `t18-shuk`

Pattern rule (this task was moved to Sonnet to save cost): do not invent a new look. Open the finished Home Row Meadow scene (src/scenes/meadow, T14) and the engine kit, copy their structure, lighting quality and feel, and take screenshots with Playwright to compare your scene against the Meadow before merging. Make your scene clearly different in palette, weather, mechanic and music, but equally polished.

Done when: The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T18: Scene: The Night Shuk (branch: t18-shuk)
Goal: Build the "The Night Shuk" scene as a distinct, beautiful, exciting 3D level whose mechanic is: punctuation is currency: fast-talking merchants throw prices and haggles full of symbols, and typing them wins the trade
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T18 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (scene table), src/engine/scene.ts, one existing scene folder as a pattern).
2. Start from the latest main and create the branch t18-shuk.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T18 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T19 · Scene: The Jaffa Line

Owner: **Sonnet** · Effort: **High** · Branch: `t19-rail`

Pattern rule (this task was moved to Sonnet to save cost): do not invent a new look. Open the finished Home Row Meadow scene (src/scenes/meadow, T14) and the engine kit, copy their structure, lighting quality and feel, and take screenshots with Playwright to compare your scene against the Meadow before merging. Make your scene clearly different in palette, weather, mechanic and music, but equally polished.

Done when: The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T19: Scene: The Jaffa Line (branch: t19-rail)
Goal: Build the "The Jaffa Line" scene as a distinct, beautiful, exciting 3D level whose mechanic is: a rail race against Naftali where typing sustains boost and combo streaks carry the train through bends
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T19 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (scene table), src/engine/scene.ts, one existing scene folder as a pattern).
2. Start from the latest main and create the branch t19-rail.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T19 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T20 · Scene: The Sunken Geniza

Owner: **Opus** · Effort: **High** · Branch: `t20-geniza`

Pattern rule (this task was moved to Sonnet to save cost): do not invent a new look. Open the finished Home Row Meadow scene (src/scenes/meadow, T14) and the engine kit, copy their structure, lighting quality and feel, and take screenshots with Playwright to compare your scene against the Meadow before merging. Make your scene clearly different in palette, weather, mechanic and music, but equally polished.

Done when: The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T20: Scene: The Sunken Geniza (branch: t20-geniza)
Goal: Build the "The Sunken Geniza" scene as a distinct, beautiful, exciting 3D level whose mechanic is: typing in rhythm with the tide: steady pace opens currents and lifts pages, bursts stir silt; rewards consistency
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T20 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (scene table), src/engine/scene.ts, one existing scene folder as a pattern).
2. Start from the latest main and create the branch t20-geniza.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T20 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T21 · Scene: Wings over Hermon

Owner: **Opus** · Effort: **High** · Branch: `t21-hermon`

Pattern rule (this task was moved to Sonnet to save cost): do not invent a new look. Open the finished Home Row Meadow scene (src/scenes/meadow, T14) and the engine kit, copy their structure, lighting quality and feel, and take screenshots with Playwright to compare your scene against the Meadow before merging. Make your scene clearly different in palette, weather, mechanic and music, but equally polished.

Done when: The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T21: Scene: Wings over Hermon (branch: t21-hermon)
Goal: Build the "Wings over Hermon" scene as a distinct, beautiful, exciting 3D level whose mechanic is: a storm flight in cockpit view where words fall like hail and must be finished before they land; lightning reveals the next word
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T21 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (scene table), src/engine/scene.ts, one existing scene folder as a pattern).
2. Start from the latest main and create the branch t21-hermon.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T21 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T22 · Scene: The Star Station

Owner: **Opus** · Effort: **High** · Branch: `t22-station`

Pattern rule (this task was moved to Sonnet to save cost): do not invent a new look. Open the finished Home Row Meadow scene (src/scenes/meadow, T14) and the engine kit, copy their structure, lighting quality and feel, and take screenshots with Playwright to compare your scene against the Meadow before merging. Make your scene clearly different in palette, weather, mechanic and music, but equally polished.

Done when: The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T22: Scene: The Star Station (branch: t22-station)
Goal: Build the "The Star Station" scene as a distinct, beautiful, exciting 3D level whose mechanic is: zero gravity: sentences fire thrusters to drift between modules and turrets to clear debris
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T22 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (scene table), src/engine/scene.ts, one existing scene folder as a pattern).
2. Start from the latest main and create the branch t22-station.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T22 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T23 · Scene: Atbash City

Owner: **Opus** · Effort: **High** · Branch: `t23-atbash`

Pattern rule (this task was moved to Sonnet to save cost): do not invent a new look. Open the finished Home Row Meadow scene (src/scenes/meadow, T14) and the engine kit, copy their structure, lighting quality and feel, and take screenshots with Playwright to compare your scene against the Meadow before merging. Make your scene clearly different in palette, weather, mechanic and music, but equally polished.

Done when: The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T23: Scene: Atbash City (branch: t23-atbash)
Goal: Build the "Atbash City" scene as a distinct, beautiful, exciting 3D level whose mechanic is: timed cipher puzzles (atbash decoding, sequence memory) while patrol drones pass; type the code before the patrol returns
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T23 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (scene table), src/engine/scene.ts, one existing scene folder as a pattern).
2. Start from the latest main and create the branch t23-atbash.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T23 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T24 · Scene: The Long Midbar

Owner: **Opus** · Effort: **High** · Branch: `t24-midbar`

Pattern rule (this task was moved to Sonnet to save cost): do not invent a new look. Open the finished Home Row Meadow scene (src/scenes/meadow, T14) and the engine kit, copy their structure, lighting quality and feel, and take screenshots with Playwright to compare your scene against the Meadow before merging. Make your scene clearly different in palette, weather, mechanic and music, but equally polished.

Done when: The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T24: Scene: The Long Midbar (branch: t24-midbar)
Goal: Build the "The Long Midbar" scene as a distinct, beautiful, exciting 3D level whose mechanic is: survival crossing: sentences keep the caravan moving toward the oasis while sandstorms cut visibility and shorten the lookahead
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T24 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (scene table), src/engine/scene.ts, one existing scene folder as a pattern).
2. Start from the latest main and create the branch t24-midbar.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T24 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T25 · Scene: The Lantern Caves

Owner: **Opus** · Effort: **High** · Branch: `t25-caves`

Pattern rule (this task was moved to Sonnet to save cost): do not invent a new look. Open the finished Home Row Meadow scene (src/scenes/meadow, T14) and the engine kit, copy their structure, lighting quality and feel, and take screenshots with Playwright to compare your scene against the Meadow before merging. Make your scene clearly different in palette, weather, mechanic and music, but equally polished.

Done when: The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T25: Scene: The Lantern Caves (branch: t25-caves)
Goal: Build the "The Lantern Caves" scene as a distinct, beautiful, exciting 3D level whose mechanic is: tense stealth: accurate typing keeps the lantern lit; shadows creep closer on stumbles and retreat on clean streaks
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T25 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (scene table), src/engine/scene.ts, one existing scene folder as a pattern).
2. Start from the latest main and create the branch t25-caves.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T25 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T26 · The Silent Arena: remaining bosses

Owner: **Opus** · Effort: **High** · Branch: `t26-arena-bosses`

Pattern rule (this task was moved to Sonnet to save cost): do not invent a new look. Open the finished Home Row Meadow scene (src/scenes/meadow, T14) and the engine kit, copy their structure, lighting quality and feel, and take screenshots with Playwright to compare your scene against the Meadow before merging. Make your scene clearly different in palette, weather, mechanic and music, but equally polished.

Done when: All arena bosses are winnable on every difficulty and feel distinct.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T26: The Silent Arena: remaining bosses (branch: t26-arena-bosses)
Goal: Three more multi-phase bosses in the arena, each testing a different skill.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T26 in docs/ROADMAP.md. Only open the code files this task needs (start with: src/game boss framework, src/scenes arena folder).
2. Start from the latest main and create the branch t26-arena-bosses.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T26 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T27 · The Blank Scroll and the Keeper

Owner: **Fable** · Effort: **Xhigh** · Branch: `t27-final`

Done when: The game can be finished from a fresh profile; the ending lands emotionally; no soft-locks.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T27: The Blank Scroll and the Keeper (branch: t27-final)
Goal: The final sequence combining every mechanic, the Keeper fight, and the ending.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T27 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (Story), boss framework).
2. Start from the latest main and create the branch t27-final.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T27 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T28 · Scene: The Ladder (endless)

Owner: **Opus** · Effort: **Medium** · Branch: `t28-ladder`

Pattern rule (this task was moved to Sonnet to save cost): do not invent a new look. Open the finished Home Row Meadow scene (src/scenes/meadow, T14) and the engine kit, copy their structure, lighting quality and feel, and take screenshots with Playwright to compare your scene against the Meadow before merging. Make your scene clearly different in palette, weather, mechanic and music, but equally polished.

Done when: The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T28: Scene: The Ladder (endless) (branch: t28-ladder)
Goal: Build the "The Ladder (endless)" scene as a distinct, beautiful, exciting 3D level whose mechanic is: an endless climb where each floor is a short random challenge drawn from all mechanics, with modifiers and a high-score table
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T28 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (scene table), src/engine/scene.ts, one existing scene folder as a pattern).
2. Start from the latest main and create the branch t28-ladder.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T28 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T29 · Arcade: host and the 3D classics

Owner: **Sonnet** · Effort: **High** · Branch: `t29-arcade-classics`

Done when: The five 3D classics launch from the Game Room, use the profile's layout and weak keys, and keep their best scores.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T29: Arcade: host and the 3D classics (branch: t29-arcade-classics)
Goal: Bring the earlier plugin's games into the hub's Game Room without rewriting them.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T29 in docs/ROADMAP.md. Only open the code files this task needs (start with: reference/plugin-4.2.0/index.html, js/games.js, js/game3d-common.js (in parts)).
2. Start from the latest main and create the branch t29-arcade-classics.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T29 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T30 · Arcade: new-generation and quick games

Owner: **Sonnet** · Effort: **Medium** · Branch: `t30-arcade-newgen`

Done when: All 16 games launch and save; the lobby shows them in three clear groups.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T30: Arcade: new-generation and quick games (branch: t30-arcade-newgen)
Goal: The rest of the 16 games in the same lobby.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T30 in docs/ROADMAP.md. Only open the code files this task needs (start with: reference/plugin-4.2.0/js/plus.js, newgen.js, plus-games.js (in parts)).
2. Start from the latest main and create the branch t30-arcade-newgen.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T30 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T31 · Modes: Practice, Time Attack, Survival, Daily

Owner: **Sonnet** · Effort: **Medium** · Branch: `t31-modes`

Done when: Each mode starts from the hub, is completable, and records results in history.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T31: Modes: Practice, Time Attack, Survival, Daily (branch: t31-modes)
Goal: The non-story modes, built from existing scenes and kits.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T31 in docs/ROADMAP.md. Only open the code files this task needs (start with: src/game, src/learn public APIs).
2. Start from the latest main and create the branch t31-modes.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T31 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T32 · Statistics dashboard and journal

Owner: **Sonnet** · Effort: **Medium** · Branch: `t32-dashboard-journal`

Done when: After a few sessions the dashboard shows correct numbers (unit-tested aggregations) in both languages.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T32: Statistics dashboard and journal (branch: t32-dashboard-journal)
Goal: Show progress clearly, and collect lore and tips.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T32 in docs/ROADMAP.md. Only open the code files this task needs (start with: src/save schema, docs/DESIGN.md components).
2. Start from the latest main and create the branch t32-dashboard-journal.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T32 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T33 · Progression, abilities, shop and cosmetics

Owner: **Opus** · Effort: **Medium** · Branch: `t33-progression`

Done when: Abilities change how runs feel, cosmetics show on the character, and a new profile's first two hours have a steady stream of unlocks.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T33: Progression, abilities, shop and cosmetics (branch: t33-progression)
Goal: A light, readable progression that makes the player want one more run.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T33 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md (Progression), src/game).
2. Start from the latest main and create the branch t33-progression.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T33 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T34 · Art, lighting, VFX and music pass

Owner: **Fable** · Effort: **Xhigh** · Branch: `t34-polish-pass`

Done when: No scene feels like homework or looks unfinished; checklist recorded per scene in the progress log.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T34: Art, lighting, VFX and music pass (branch: t34-polish-pass)
Goal: Raise every scene to the same top standard.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T34 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md checklist).
2. Start from the latest main and create the branch t34-polish-pass.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T34 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T35 · Full story: cutscenes and voice

Owner: **Sonnet** · Effort: **High** · Branch: `t35-story-full`

Done when: A full playthrough tells a coherent, moving story in both languages.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T35: Full story: cutscenes and voice (branch: t35-story-full)
Goal: The complete three-act arc told through cutscenes, banter and the journal.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T35 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/GAME_DESIGN.md, src/story).
2. Start from the latest main and create the branch t35-story-full.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T35 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T36 · Settings, accessibility and health

Owner: **Sonnet** · Effort: **Medium** · Branch: `t36-settings-a11y`

Done when: Every option changes the game immediately and persists; an automated check tabs through each menu.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T36: Settings, accessibility and health (branch: t36-settings-a11y)
Goal: Every option in DESIGN 'Accessibility' and the brief's settings, working.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T36 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/DESIGN.md (Accessibility), src/ui).
2. Start from the latest main and create the branch t36-settings-a11y.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T36 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T37 · Ghosts and local leaderboards

Owner: **Sonnet** · Effort: **Medium** · Branch: `t37-ghosts`

Done when: A ghost of the best run appears on replay and beating it updates the board.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T37: Ghosts and local leaderboards (branch: t37-ghosts)
Goal: Race your own best runs.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T37 in docs/ROADMAP.md. Only open the code files this task needs (start with: src/scenes/rail, src/save).
2. Start from the latest main and create the branch t37-ghosts.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T37 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T38 · Performance pass and full smoke tests

Owner: **Sonnet** · Effort: **High** · Branch: `t38-perf-tests`

Done when: CI runs the whole suite green and docs/PERF.md lists every scene within budget.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T38: Performance pass and full smoke tests (branch: t38-perf-tests)
Goal: Prove every scene loads and stays within budget.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T38 in docs/ROADMAP.md. Only open the code files this task needs (start with: docs/ARCHITECTURE.md section 7).
2. Start from the latest main and create the branch t38-perf-tests.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T38 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

## T39 · Release: website and Otzaria plugin 1.0

Owner: **Sonnet** · Effort: **Medium** · Branch: `t39-release`

Done when: The live site is 1.0 and the release workflow is ready.

```
Otiyot project — GitHub repo shlomyeisenberg-lang/Otiyot.
Task T39: Release: website and Otzaria plugin 1.0 (branch: t39-release)
Goal: A finished 1.0 on the live link and as an installable plugin file.
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md and task T39 in docs/ROADMAP.md. Only open the code files this task needs (start with: plugin/, README.md).
2. Start from the latest main and create the branch t39-release.
3. Work from start to finish without stopping for my approval. Make sensible decisions yourself and record the important ones.
4. Do everything to the end without stopping: build it, run lint, typecheck, tests and build, tick the task in ROADMAP.md, update docs/progress.json for T39 (see "Progress log" in CLAUDE.md) and run node scripts/render-progress.mjs, push, open a pull request, wait for the checks to pass (fix anything that fails), then merge it into main yourself and delete the branch. If docs/progress.json conflicts, keep both sides; if docs/PROGRESS.md conflicts, regenerate it with the script.
5. When it is merged, tell me in plain words what was built, how to try it on the live link, and which manual steps are waiting for me.
```

Extra rule for unattended runs: PREPARE ONLY: do not create the version tag or publish the GitHub Release. Build everything up to that step and list 'publish the 1.0 release' and 'install the plugin in Otzaria and try it' as manual steps with browser prompts.
