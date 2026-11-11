# Otiyot — Roadmap

One task = one chat = one branch = one pull request, merged into main by that chat.

Legend: `[ ]` not done · `[x]` merged. **Model** says who builds it: Fable 5.2 builds the tasks that need the most taste and skill (T14 Meadow, T16 boss kit, T27 final fight, T34 polish pass); Opus 5.5 finishes T13 (the hub, already running); Sonnet 5.5 builds everything else.

## Phase 0 · Foundation (logic, no visuals)

### [x] T01 · Project setup, CI and plugin packer
- **Branch** `t01-setup`
- **Model** Sonnet 5.5 · **Effort** Medium
- **Goal** A running empty project that builds as a website and as an Otzaria plugin, with checks on every pull request.
- **Scope**
  - Vite + TypeScript strict + pnpm, ESLint, Prettier, Vitest, Playwright (Chromium)
  - Folder skeleton from ARCHITECTURE section 2 with a placeholder boot screen that says Otiyot
  - pnpm build (web, relative base) and pnpm build:plugin (zips dist + plugin/manifest.json into dist-plugin/otiyot-<version>.otzplugin; base the manifest on reference/plugin-4.2.0/manifest.json with id il.otzaria.otiyot)
  - .github/workflows/ci.yml: lint, typecheck, unit tests, build, plugin build uploaded as an artifact, Playwright smoke
  - vercel.json for a static Vite site; README (install, run, test, build, deploy), ASSETS.md, CHANGELOG.md, ASSUMPTIONS.md pointing to ARCHITECTURE section 10
  - Add a manual step with a browser prompt: import the repo into Vercel
- **Done when** CI is green, `pnpm dev` shows the boot screen, and the plugin file is produced.
- **User must have ready** Nothing.

### [x] T02 · Typing core
- **Branch** `t02-typing-core`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** The pure-logic typing engine every scene and mode will use.
- **Scope**
  - src/core: Hebrew (standard Israeli) and English (QWERTY) layouts keyed by KeyboardEvent.code, with finger and row for every key, shift layer, final letters, niqqud, numbers, symbols
  - TypingSession: expected text in, judged TypedKey out (correct/wrong, expected vs typed char, ms since last key); errors never block; backspace policy configurable; hardcore flag
  - Metrics: gross and net WPM, accuracy, consistency, per-key and per-finger stats, confusion pairs, wrong-finger and home-row-drift hints inferred from timing/error patterns
  - Port behaviour from reference/plugin-4.2.0/js/typing-engine.js and constants.js; do not copy its DOM code
  - Thorough unit tests incl. layout mapping and mixed Hebrew/English lines
- **Done when** Unit tests cover scoring, layout mapping and a recorded session for both layouts.
- **User must have ready** Nothing.

### [x] T03 · Saves and profiles
- **Branch** `t03-saves`
- **Model** Sonnet 5.5 · **Effort** Medium
- **Goal** Reliable local saves with several profiles, in the browser and inside Otzaria.
- **Scope**
  - src/save: schema from ARCHITECTURE section 4, version + migrations with tests
  - SaveStore adapters: localStorage and Otzaria (Otzaria.call('storage.get'/'storage.set'), see reference/plugin-4.2.0/js/storage.js); auto-detect at boot
  - Debounced autosave, corrupt-save recovery (keep last good copy)
  - Profiles: create, rename, delete, switch
  - Export and import as JSON; one-time import of old plugin progress when found in Otzaria storage
- **Done when** Tests prove round-trip, migration from an older version, recovery from a corrupt save, and both adapters (Otzaria mocked).
- **User must have ready** Nothing.

### [x] T04 · The two lesson tracks
- **Branch** `t04-lesson-tracks`
- **Model** Sonnet 5.5 · **Effort** Medium
- **Goal** Both built-in courses, selectable per profile: Track 1 from plugin 3.3.0 and Track 2 from plugin 4.2.0.
- **Scope**
  - src/learn/track1.ts: port the Hebrew and English curriculum of reference/plugin-3.3.0/js/lessons.js + constants.js (levels, lessons, tips, generators) faithfully
  - src/learn/track2.ts: same for reference/plugin-4.2.0/js/lessons.js + constants.js
  - Common Track interface: levels, lessons, text generator, key set introduced, unlock rule (accuracy threshold, default 90%)
  - Progress kept per track; active track stored on the profile; switching never loses progress
  - TextSource: given profile + scene band, returns the next words/sentences from the active track
  - Unit tests comparing generated lessons with the originals for a sample of lessons in each track and language
- **Done when** Both tracks produce the same lesson content as their originals, for Hebrew and English, and switching tracks works in tests.
- **User must have ready** Nothing.

### [x] T05 · Word and sentence library
- **Branch** `t05-word-library`
- **Model** Sonnet 5.5 · **Effort** Medium
- **Goal** A large built-in library of words and sentences by difficulty tier, with Jewish-themed packs, plus custom lists.
- **Scope**
  - Port reference/plugin-4.2.0/js/lexicon.js; extend to thousands of Hebrew and English words in tiers (by length, row coverage, frequency)
  - Themed packs for scenes: everyday, home, market, numbers and gematria, travel, sea, sky and stars, desert, holidays and seasons, proverbs and sayings (sentences)
  - Obey the content rules in ARCHITECTURE section 8; add a unit test with a blocklist (holy Names) that scans every pack
  - Filter API: words that use only an allowed key set, weighted toward given weak keys
  - Custom word lists and imported plain-text files, stored on the profile
  - A helper agent on a cheaper model may draft lists; review them
- **Done when** At least 3,000 Hebrew and 3,000 English words plus 300 sentences each, all passing the content test; filter API unit-tested.
- **User must have ready** Nothing.

### [x] T06 · Adaptive engine and spaced repetition
- **Branch** `t06-adaptive`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Drills that lean on the player's weak keys while keeping flow, with scheduled review.
- **Scope**
  - Port reference/plugin-4.2.0/js/adaptive.js and pedagogy.js into src/learn (pure logic)
  - Per-key and per-finger skill model (accuracy, speed, confusions); weak-key selection mixed with mastered keys
  - Spaced repetition scheduling of keys and letter pairs; 'due today' list
  - TextSource uses it to weight words; key-set unlock gate
  - Deterministic with a seed; unit tests
- **Done when** Given a simulated weak-key profile, generated drills over-sample the weak keys within set bounds, and review dates advance correctly in tests.
- **User must have ready** Nothing.

## Phase 1 · Vertical slice (must already feel great)

### [x] T07 · Design system and UI shell
- **Branch** `t07-design-system`
- **Model** Opus 5.5 · **Effort** High
- **Goal** Turn DESIGN.md into real tokens, fonts and components, with Hebrew RTL and English LTR, and the menu shell.
- **Scope**
  - Load the frontend-design skill first
  - tokens.css (light, dark, colorblind, high-contrast), bundled fonts, every component in DESIGN 'Core components'
  - i18n loader with locales/he.json + en.json, dir switching, mixed-direction text helper
  - Screens: main menu, profile select/create, track picker (Track 1 vs Track 2 with a clear plain explanation of each), layout picker, pause menu, settings skeleton
  - Every menu item selectable by typing its highlighted letter, plus arrows/Enter/Esc
  - /styleguide page (dev only)
- **Done when** Menus are beautiful and usable in both languages and themes at 1366×768 and 375px; a new profile can be created with a track and layout.
- **User must have ready** Nothing.

### [x] T08 · 3D engine kit
- **Branch** `t08-engine-kit`
- **Model** Opus 5.5 · **Effort** Xhigh
- **Goal** The reusable 3D foundation every scene is built on, tuned for integrated graphics.
- **Scope**
  - Renderer, resize, fixed-step loop, quality presets with first-run benchmark (ARCHITECTURE section 7)
  - Post FX chain: bloom, tone mapping, color grading, vignette, chromatic aberration pulse on hits, SSAO on high+; cascaded sun shadows on high+, blob shadows on low; height/volumetric-style fog and god rays (cheap screen-space)
  - Scene manager + GameScene/SceneContext (src/engine/scene.ts), loading transitions (ink wipe), full disposal tracking
  - Camera rig: third-person follow with collision, rail and cockpit modes, shake, push-in, hit-stop
  - VFX kit: pooled particles, ink trails, letter fragments, shockwaves, color-restoration sweep shader (grey to color from a point), screen flash
  - Procedural character rig: stylized modest figures with idle, walk, run, write, hit, stagger, fall, cheer and smooth blending; palette.ts mirroring tokens
  - A dev 'test range' scene showing all of it; perf overlay (fps, draw calls, triangles)
- **Done when** The test range runs at 60 fps on medium, shows every effect and animation, and leaves zero leaked GPU objects after dispose (test).
- **User must have ready** Nothing.

### [x] T09 · 3D keyboard, finger guide, HUD and typing feedback
- **Branch** `t09-keyboard-hud`
- **Model** Opus 5.5 · **Effort** High
- **Goal** The moment-to-moment feel of typing: what the player sees and feels on every key.
- **Scope**
  - 3D on-screen keyboard for both layouts: next key glows, finger color coding, pressed-key animation, hideable; optional animated hands
  - Text strip: current word, lookahead word dimmed, per-letter states, correct RTL and mixed Hebrew/English rendering; in-world text helper (carved, banner, hologram styles)
  - HUD: combo meter that grows and changes material with the streak, small WPM/accuracy, toast hints for wrong-finger and home-row drift (gentle)
  - Feedback wiring: correct key = ink stroke + impact; wrong key = short stumble + desaturate flicker, never blocks
  - Wire the typing core to the scene manager so scenes receive judged keys
- **Done when** In the test range a full lesson can be typed in Hebrew and English with satisfying feedback, correct RTL, and the finger guide always showing the next key (also right after an error).
- **User must have ready** Nothing.

### [x] T10 · Audio engine and first music themes
- **Branch** `t10-audio`
- **Model** Opus 5.5 · **Effort** High
- **Goal** Procedural sound that makes typing feel musical.
- **Scope**
  - Web Audio mixer with music / effects / voice / UI volumes
  - Key clicks with per-key variation, pitch rising on a scale with combo, soft distinct error sound, impacts, UI sounds
  - Adaptive music engine: stems (drone, pulse, melody, counter, percussion) layered by combo level, bar-synced transitions, boss phase sections
  - Themes for title, hub, meadow, cliffs and boss, following DESIGN 'Sound direction'
  - Positional audio helper for enemies and ambience; starts only after first key press (browser rule)
- **Done when** Each theme is distinct and pleasant for 10 minutes, stems audibly build with the combo, and volumes work.
- **User must have ready** Nothing.

### [x] T11 · Combat, combo and difficulty kit
- **Branch** `t11-combat-kit`
- **Model** Opus 5.5 · **Effort** High
- **Goal** Word-shield enemies and the combo system shared by all action scenes.
- **Scope**
  - src/game: Blot enemies with word shields (targeting by first letter, lock-on, shield break VFX, restoration burst)
  - Combo: tiers that raise power, VFX intensity and music layer; breaks softly on errors (ability hooks for Steady Hand)
  - Five difficulties (GAME_DESIGN) as data: time pressure, error cost, word complexity, enemy pace; Calm has no timers
  - Run results: rank S/A/B/C (accuracy first), XP, glyphs and ink earned; results screen
  - Enemy spawner patterns driven by a seed
  - Level system: every scene run takes a level (Easy / Standard / Hard) and builds its text from the profile's learned key set only (see GAME_DESIGN 'Levels follow your learning'); unit test that no unlearned key ever appears; auto-level suggestion from recent accuracy and speed
- **Done when** A sandbox wave fight in the test range is fun on all five difficulties and ends with a results screen.
- **User must have ready** Nothing.

### [x] T12 · Story system, title screen and intro
- **Branch** `t12-story-title`
- **Model** Opus 5.5 · **Effort** High
- **Goal** In-engine cutscenes and dialogue, the title screen, and the opening of the story.
- **Scope**
  - Cutscene player: timed camera shots, character actions, text and VFX cues from data; skippable
  - Dialogue box with portraits, subtitles, adjustable text speed, optional speech synthesis voice per character; he + en scripts in src/story
  - Title: gold-ink letters fall onto a blank parchment and form the name, camera fly-through
  - Intro: the lamp-sign goes blank; Reb Ezra gives the quill; Dyo appears (Act 1 opening in GAME_DESIGN)
  - Write the characters with real personality; keep lines short
  - All characters are male (no women anywhere); player look options are male apprentices only
- **Done when** From launch: title → new game → intro cutscene plays, can be skipped, and hands over to the hub.
- **User must have ready** Nothing.

### [ ] T13 · Hub: the House of the Scribe
- **Branch** `t13-hub`
- **Model** Opus 5.5 · **Effort** High
- **Goal** A living home base that works as the game's menu.
- **Scope**
  - Handcrafted interior + courtyard with day/night cycle and view over the hills
  - Stations chosen by typing their word: Desk (continue story / map of scenes), Game Room door (shows an in-world 'opening soon' sign until the arcade tasks are merged; record that in todo), Shop shelf, Trophy shelf (ranks), Journal, Practice corner, Settings
  - NPCs: Reb Ezra and Dyo with idle behaviour and context lines; Naftali drops by after scene 7
  - Scene map showing restored vs faded regions
  - Scene map unlocks by course progress, shows levels per scene, suggests the best level, and for a locked scene shows what to learn first with a jump to that lesson. All hub NPCs are male
- **Done when** The player can walk the hub by typing, start any unlocked scene, and the hub visibly gains color as regions are restored.
- **User must have ready** Nothing.

### [ ] T14 · Scene: Home Row Meadow
- **Branch** `t14-meadow`
- **Model** Fable 5.2 · **Effort** High
- **Goal** Build the "Home Row Meadow" scene as a distinct, beautiful, exciting 3D level whose mechanic is: a gentle guided tutorial where typing home-row letters restores flowers, grass and birdsong; Reb Ezra teaches hand placement through play in the first five minutes; skippable
- **Scope**
  - New folder src/scenes/meadow/ implementing GameScene
  - a gentle guided tutorial where typing home-row letters restores flowers, grass and birdsong; Reb Ezra teaches hand placement through play in the first five minutes; skippable
  - Onboarding lives here: finger placement, the guide keyboard, lookahead, combo. No timers.
  - Follow the GameScene contract and the scene row in GAME_DESIGN. Own palette, lighting, weather, music theme (via the audio kit) and enemies. Text comes only from the TextSource. Grey-to-color restoration must be visible as the player types. Rank S/A/B/C at the end. Completable on every difficulty, no soft-locks. Add the scene to the hub's map and a Playwright smoke test.
- **Done when** The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.
- **User must have ready** Nothing.

### [ ] T15 · Scene: Cliffs of Ein Gedi
- **Branch** `t15-cliffs`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Build the "Cliffs of Ein Gedi" scene as a distinct, beautiful, exciting 3D level whose mechanic is: stepping stones over a canyon where top-row words make the scribe reach up and bottom-row words reach down; waterfalls restart as sections are restored
- **Scope**
  - New folder src/scenes/cliffs/ implementing GameScene
  - stepping stones over a canyon where top-row words make the scribe reach up and bottom-row words reach down; waterfalls restart as sections are restored
  - Follow the GameScene contract and the scene row in GAME_DESIGN. Own palette, lighting, weather, music theme (via the audio kit) and enemies. Text comes only from the TextSource. Grey-to-color restoration must be visible as the player types. Rank S/A/B/C at the end. Completable on every difficulty, no soft-locks. Add the scene to the hub's map and a Playwright smoke test.
- **Done when** The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.
- **User must have ready** Nothing.

### [ ] T16 · Boss kit and the first boss
- **Branch** `t16-boss-kit`
- **Model** Fable 5.2 · **Effort** Xhigh
- **Goal** The multi-phase boss framework and a first boss that is the dramatic peak of the slice.
- **Scope**
  - Boss framework: 3–4 phases as data (text type per phase, attack patterns, weak points), cinematic transitions (hit-stop, push-in, palette shift, music section change), health as an erased-to-restored bar
  - First boss in the Silent Arena shell: 'The Great Blot' — phase 1 single words, phase 2 sentences, phase 3 punctuated passage, phase 4 sudden layout/order twist
  - Fair telegraphs, checkpoints between phases on lower difficulties, no soft-locks
  - Victory cutscene restoring the region; unlocks Phase 2 scenes
- **Done when** The boss fight is winnable on every difficulty, each phase feels different, and transitions are cinematic. Phase 1 slice is complete: title → hub → two scenes → boss → save/load.
- **User must have ready** Nothing.

## Phase 2 · The world

### [ ] T17 · Scene: The Gematria Forge
- **Branch** `t17-forge`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Build the "The Gematria Forge" scene as a distinct, beautiful, exciting 3D level whose mechanic is: typing numbers (and letter values) keeps the furnace temperature in the safe band while the smith forges letters
- **Scope**
  - New folder src/scenes/forge/ implementing GameScene
  - typing numbers (and letter values) keeps the furnace temperature in the safe band while the smith forges letters
  - Follow the GameScene contract and the scene row in GAME_DESIGN. Own palette, lighting, weather, music theme (via the audio kit) and enemies. Text comes only from the TextSource. Grey-to-color restoration must be visible as the player types. Rank S/A/B/C at the end. Completable on every difficulty, no soft-locks. Add the scene to the hub's map and a Playwright smoke test.
- **Done when** The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.
- **User must have ready** Nothing.

### [ ] T18 · Scene: The Night Shuk
- **Branch** `t18-shuk`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Build the "The Night Shuk" scene as a distinct, beautiful, exciting 3D level whose mechanic is: punctuation is currency: fast-talking merchants throw prices and haggles full of symbols, and typing them wins the trade
- **Scope**
  - New folder src/scenes/shuk/ implementing GameScene
  - punctuation is currency: fast-talking merchants throw prices and haggles full of symbols, and typing them wins the trade
  - Follow the GameScene contract and the scene row in GAME_DESIGN. Own palette, lighting, weather, music theme (via the audio kit) and enemies. Text comes only from the TextSource. Grey-to-color restoration must be visible as the player types. Rank S/A/B/C at the end. Completable on every difficulty, no soft-locks. Add the scene to the hub's map and a Playwright smoke test.
- **Done when** The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.
- **User must have ready** Nothing.

### [ ] T19 · Scene: The Jaffa Line
- **Branch** `t19-rail`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Build the "The Jaffa Line" scene as a distinct, beautiful, exciting 3D level whose mechanic is: a rail race against Naftali where typing sustains boost and combo streaks carry the train through bends
- **Scope**
  - New folder src/scenes/rail/ implementing GameScene
  - a rail race against Naftali where typing sustains boost and combo streaks carry the train through bends
  - Records a ghost of the best run (data only; replay in a later task).
  - Follow the GameScene contract and the scene row in GAME_DESIGN. Own palette, lighting, weather, music theme (via the audio kit) and enemies. Text comes only from the TextSource. Grey-to-color restoration must be visible as the player types. Rank S/A/B/C at the end. Completable on every difficulty, no soft-locks. Add the scene to the hub's map and a Playwright smoke test.
- **Done when** The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.
- **User must have ready** Nothing.

### [ ] T20 · Scene: The Sunken Geniza
- **Branch** `t20-geniza`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Build the "The Sunken Geniza" scene as a distinct, beautiful, exciting 3D level whose mechanic is: typing in rhythm with the tide: steady pace opens currents and lifts pages, bursts stir silt; rewards consistency
- **Scope**
  - New folder src/scenes/geniza/ implementing GameScene
  - typing in rhythm with the tide: steady pace opens currents and lifts pages, bursts stir silt; rewards consistency
  - Follow the GameScene contract and the scene row in GAME_DESIGN. Own palette, lighting, weather, music theme (via the audio kit) and enemies. Text comes only from the TextSource. Grey-to-color restoration must be visible as the player types. Rank S/A/B/C at the end. Completable on every difficulty, no soft-locks. Add the scene to the hub's map and a Playwright smoke test.
- **Done when** The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.
- **User must have ready** Nothing.

### [ ] T21 · Scene: Wings over Hermon
- **Branch** `t21-hermon`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Build the "Wings over Hermon" scene as a distinct, beautiful, exciting 3D level whose mechanic is: a storm flight in cockpit view where words fall like hail and must be finished before they land; lightning reveals the next word
- **Scope**
  - New folder src/scenes/hermon/ implementing GameScene
  - a storm flight in cockpit view where words fall like hail and must be finished before they land; lightning reveals the next word
  - Follow the GameScene contract and the scene row in GAME_DESIGN. Own palette, lighting, weather, music theme (via the audio kit) and enemies. Text comes only from the TextSource. Grey-to-color restoration must be visible as the player types. Rank S/A/B/C at the end. Completable on every difficulty, no soft-locks. Add the scene to the hub's map and a Playwright smoke test.
- **Done when** The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.
- **User must have ready** Nothing.

### [ ] T22 · Scene: The Star Station
- **Branch** `t22-station`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Build the "The Star Station" scene as a distinct, beautiful, exciting 3D level whose mechanic is: zero gravity: sentences fire thrusters to drift between modules and turrets to clear debris
- **Scope**
  - New folder src/scenes/station/ implementing GameScene
  - zero gravity: sentences fire thrusters to drift between modules and turrets to clear debris
  - Follow the GameScene contract and the scene row in GAME_DESIGN. Own palette, lighting, weather, music theme (via the audio kit) and enemies. Text comes only from the TextSource. Grey-to-color restoration must be visible as the player types. Rank S/A/B/C at the end. Completable on every difficulty, no soft-locks. Add the scene to the hub's map and a Playwright smoke test.
- **Done when** The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.
- **User must have ready** Nothing.

### [ ] T23 · Scene: Atbash City
- **Branch** `t23-atbash`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Build the "Atbash City" scene as a distinct, beautiful, exciting 3D level whose mechanic is: timed cipher puzzles (atbash decoding, sequence memory) while patrol drones pass; type the code before the patrol returns
- **Scope**
  - New folder src/scenes/atbash/ implementing GameScene
  - timed cipher puzzles (atbash decoding, sequence memory) while patrol drones pass; type the code before the patrol returns
  - Follow the GameScene contract and the scene row in GAME_DESIGN. Own palette, lighting, weather, music theme (via the audio kit) and enemies. Text comes only from the TextSource. Grey-to-color restoration must be visible as the player types. Rank S/A/B/C at the end. Completable on every difficulty, no soft-locks. Add the scene to the hub's map and a Playwright smoke test.
- **Done when** The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.
- **User must have ready** Nothing.

### [ ] T24 · Scene: The Long Midbar
- **Branch** `t24-midbar`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Build the "The Long Midbar" scene as a distinct, beautiful, exciting 3D level whose mechanic is: survival crossing: sentences keep the caravan moving toward the oasis while sandstorms cut visibility and shorten the lookahead
- **Scope**
  - New folder src/scenes/midbar/ implementing GameScene
  - survival crossing: sentences keep the caravan moving toward the oasis while sandstorms cut visibility and shorten the lookahead
  - Follow the GameScene contract and the scene row in GAME_DESIGN. Own palette, lighting, weather, music theme (via the audio kit) and enemies. Text comes only from the TextSource. Grey-to-color restoration must be visible as the player types. Rank S/A/B/C at the end. Completable on every difficulty, no soft-locks. Add the scene to the hub's map and a Playwright smoke test.
- **Done when** The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.
- **User must have ready** Nothing.

### [ ] T25 · Scene: The Lantern Caves
- **Branch** `t25-caves`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Build the "The Lantern Caves" scene as a distinct, beautiful, exciting 3D level whose mechanic is: tense stealth: accurate typing keeps the lantern lit; shadows creep closer on stumbles and retreat on clean streaks
- **Scope**
  - New folder src/scenes/caves/ implementing GameScene
  - tense stealth: accurate typing keeps the lantern lit; shadows creep closer on stumbles and retreat on clean streaks
  - Tense, not horror. Follow the content rules.
  - Follow the GameScene contract and the scene row in GAME_DESIGN. Own palette, lighting, weather, music theme (via the audio kit) and enemies. Text comes only from the TextSource. Grey-to-color restoration must be visible as the player types. Rank S/A/B/C at the end. Completable on every difficulty, no soft-locks. Add the scene to the hub's map and a Playwright smoke test.
- **Done when** The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.
- **User must have ready** Nothing.

### [ ] T26 · The Silent Arena: remaining bosses
- **Branch** `t26-arena-bosses`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Three more multi-phase bosses in the arena, each testing a different skill.
- **Scope**
  - Boss of Speed (bursts), Boss of Precision (errors heal it), Boss of Endurance (long passage, shifting tides) using the boss kit
  - Each with its own look, music section set and transition
  - Arena select board; ranks per boss
- **Done when** All arena bosses are winnable on every difficulty and feel distinct.
- **User must have ready** Nothing.

### [ ] T27 · The Blank Scroll and the Keeper
- **Branch** `t27-final`
- **Model** Fable 5.2 · **Effort** Xhigh
- **Goal** The final sequence combining every mechanic, the Keeper fight, and the ending.
- **Scope**
  - A run through short sections reusing each region's mechanic on white parchment that inks in as you go
  - The Keeper: 4 phases; the last is typing his lost words back faster than he erases (Act 3)
  - Naftali and Reb Ezra assist via short typed prompts
  - Ending cutscene, credits typed by the player, New Game+ flag
- **Done when** The game can be finished from a fresh profile; the ending lands emotionally; no soft-locks.
- **User must have ready** Nothing.

### [ ] T28 · Scene: The Ladder (endless)
- **Branch** `t28-ladder`
- **Model** Sonnet 5.5 · **Effort** Medium
- **Goal** Build the "The Ladder (endless)" scene as a distinct, beautiful, exciting 3D level whose mechanic is: an endless climb where each floor is a short random challenge drawn from all mechanics, with modifiers and a high-score table
- **Scope**
  - New folder src/scenes/ladder/ implementing GameScene
  - an endless climb where each floor is a short random challenge drawn from all mechanics, with modifiers and a high-score table
  - Text is fully adaptive (weak keys). Local high scores per profile.
  - Follow the GameScene contract and the scene row in GAME_DESIGN. Own palette, lighting, weather, music theme (via the audio kit) and enemies. Text comes only from the TextSource. Grey-to-color restoration must be visible as the player types. Rank S/A/B/C at the end. Completable on every difficulty, no soft-locks. Add the scene to the hub's map and a Playwright smoke test.
- **Done when** The scene is playable start to finish from the hub at 60 fps on medium, feels different from every other scene, and its smoke test passes.
- **User must have ready** Nothing.

## Phase 3 · Arcade, modes and progress

### [ ] T29 · Arcade: host and the 3D classics
- **Branch** `t29-arcade-classics`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Bring the earlier plugin's games into the hub's Game Room without rewriting them.
- **Scope**
  - Copy the needed legacy files from reference/plugin-4.2.0 into public/arcade/ with a slim arcade.html
  - Bridge (postMessage): profile weak keys and word source, layout, UI language, theme tokens, save/load of the arcade blob (ARCHITECTURE section 6)
  - Working: Galaxy, Sefarim, Race, Arena, Tower
  - Lobby in Otiyot's design system grouped as 3D Classics / New Generation / Quick Games
  - Smoke test launching each game
- **Done when** The five 3D classics launch from the Game Room, use the profile's layout and weak keys, and keep their best scores.
- **User must have ready** Nothing.

### [ ] T30 · Arcade: new-generation and quick games
- **Branch** `t30-arcade-newgen`
- **Model** Sonnet 5.5 · **Effort** Medium
- **Goal** The rest of the 16 games in the same lobby.
- **Scope**
  - Letter Dash (runner), Rhythm, Fortress, the PLUS layer (perks, target letters, coins, booster shop, daily challenge), Storm and the 2D games from games.js
  - Coins shown alongside glyphs/ink; no conversion
  - Smoke test launching each game
- **Done when** All 16 games launch and save; the lobby shows them in three clear groups.
- **User must have ready** Nothing.

### [ ] T31 · Modes: Practice, Time Attack, Survival, Daily
- **Branch** `t31-modes`
- **Model** Sonnet 5.5 · **Effort** Medium
- **Goal** The non-story modes, built from existing scenes and kits.
- **Scope**
  - Practice: targeted drills (weak keys, due reviews, chosen lesson of the active track, custom text) on a clean screen
  - Time Attack and Survival: rule sets that run on any unlocked scene
  - Daily Challenge: date-seeded scene + modifiers, local best
  - Challenge modifiers (no lookahead, mirror, fog, sudden layout)
- **Done when** Each mode starts from the hub, is completable, and records results in history.
- **User must have ready** Nothing.

### [ ] T32 · Statistics dashboard and journal
- **Branch** `t32-dashboard-journal`
- **Model** Sonnet 5.5 · **Effort** Medium
- **Goal** Show progress clearly, and collect lore and tips.
- **Scope**
  - Dashboard with design-system components: WPM over time, accuracy trend, keys mastered, per-key heatmap on the keyboard, error patterns, time played, session history
  - Lesson track progress for both tracks
  - Journal/codex: characters met, regions, tips, unlocked as the story advances (text from src/story)
  - Achievements list
- **Done when** After a few sessions the dashboard shows correct numbers (unit-tested aggregations) in both languages.
- **User must have ready** Nothing.

### [ ] T33 · Progression, abilities, shop and cosmetics
- **Branch** `t33-progression`
- **Model** Sonnet 5.5 · **Effort** Medium
- **Goal** A light, readable progression that makes the player want one more run.
- **Scope**
  - XP and levels; glyphs and ink; small skill tree; abilities (Echo, Steady Hand, Second Wind and 3 more) wired into the combat kit
  - Shop shelf and crafting in the hub; cosmetics (quills, ink colors, robes) and hub decorations
  - Secrets and collectibles: one hidden letter per scene
  - Balance pass so nothing is grindy
- **Done when** Abilities change how runs feel, cosmetics show on the character, and a new profile's first two hours have a steady stream of unlocks.
- **User must have ready** Nothing.

## Phase 4 · Polish

### [ ] T34 · Art, lighting, VFX and music pass
- **Branch** `t34-polish-pass`
- **Model** Fable 5.2 · **Effort** Xhigh
- **Goal** Raise every scene to the same top standard.
- **Scope**
  - Play every scene; fix weak composition, lighting, readability and pacing using the playtest checklist in GAME_DESIGN
  - Unique music theme per region and boss sections where still shared
  - Escalating combo visuals consistent everywhere; camera never clips
  - Keep within performance budgets
- **Done when** No scene feels like homework or looks unfinished; checklist recorded per scene in the progress log.
- **User must have ready** Nothing.

### [ ] T35 · Full story: cutscenes and voice
- **Branch** `t35-story-full`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** The complete three-act arc told through cutscenes, banter and the journal.
- **Scope**
  - Cutscenes at each region's start and restoration, Naftali's arc, the Keeper's scorched pages, Dyo's running jokes
  - Speech synthesis voices tuned per character where available; captions always
  - Hebrew and English scripts both natural, not translated word for word
- **Done when** A full playthrough tells a coherent, moving story in both languages.
- **User must have ready** Nothing.

## Phase 5 · Settings and accessibility

### [ ] T36 · Settings, accessibility and health
- **Branch** `t36-settings-a11y`
- **Model** Sonnet 5.5 · **Effort** Medium
- **Goal** Every option in DESIGN 'Accessibility' and the brief's settings, working.
- **Scope**
  - Settings screens: audio, graphics preset, language, layout, track, difficulty, gameplay aids, key rebinding for menu/pause keys
  - Reduce motion, shake and flash sliders, colorblind palettes, high contrast, large text, dyslexia-friendly font, text speed, captions
  - Keyboard-only navigation with focus rings and screen-reader labels on all menus
  - Break and posture reminders (Dyo) with configurable time; off on request
- **Done when** Every option changes the game immediately and persists; an automated check tabs through each menu.
- **User must have ready** Nothing.

## Phase 6 · Launch

### [ ] T37 · Ghosts and local leaderboards
- **Branch** `t37-ghosts`
- **Model** Sonnet 5.5 · **Effort** Medium
- **Goal** Race your own best runs.
- **Scope**
  - Record ghosts (timestamps only, never text) for the rail race, Time Attack and Daily
  - Replay ghost as a translucent rival
  - Local leaderboards per profile and across profiles on this device; export/import a ghost as a file to share with a friend
- **Done when** A ghost of the best run appears on replay and beating it updates the board.
- **User must have ready** Nothing.

### [ ] T38 · Performance pass and full smoke tests
- **Branch** `t38-perf-tests`
- **Model** Sonnet 5.5 · **Effort** High
- **Goal** Prove every scene loads and stays within budget.
- **Scope**
  - Playwright smoke test for every scene and mode: loads, runs 10 seconds of scripted typing, no console errors
  - Automated soft-lock check: each scene completable by a bot typist on Calm
  - Measure draw calls, triangles, memory and GC per scene on medium; fix anything over budget (ask nothing; record what changed)
  - Bundle size report; lazy-load scenes
- **Done when** CI runs the whole suite green and docs/PERF.md lists every scene within budget.
- **User must have ready** Nothing.

### [ ] T39 · Release: website and Otzaria plugin 1.0
- **Branch** `t39-release`
- **Model** Sonnet 5.5 · **Effort** Medium
- **Goal** A finished 1.0 on the live link and as an installable plugin file.
- **Scope**
  - Final README, GAME_DESIGN, ASSETS and CHANGELOG sync
  - Version 1.0.0; GitHub workflow that builds the .otzplugin and attaches it to a GitHub Release on a version tag
  - Test the plugin build opened from a local folder (file-style relative paths, no network)
  - docs/LAUNCH.md: how to install the plugin in Otzaria, how to roll back
- **Done when** The live site is 1.0 and the release workflow is ready.
- **User must have ready** Nothing.

## Later (ideas found while building, not scheduled)

- Online duels (same text, deterministic seed, server check) and global leaderboards through Supabase; anonymous names, never typed content. Needs accounts and a server.
- Standalone Windows .exe build (wrap the web build).
- Yiddish typing track.
- More lesson tracks imported from files.
