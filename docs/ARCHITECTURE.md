# Otiyot — Architecture

> Every chat reads this file before writing code. If you change how something works, update this file in the same branch.

**What it is.** Otiyot (אותיות — "letters") is a 3D, Jewish-themed touch-typing adventure for teens and adults. The player is a young sofer (scribe) who restores the fading letters of the Land of Letters by typing. It teaches Hebrew (standard Israeli layout) and English (QWERTY) touch typing. It ships two ways from one codebase: a static website (live link) and an `.otzplugin` for the Otzaria app. It works fully offline: no logins, no server, no network calls at runtime.

**Where it comes from.** Three earlier Otzaria plugins live read-only in `reference/`:
- `reference/plugin-3.3.0` — source of **Lesson Track 1** ("letter by letter": each letter alone, home row first).
- `reference/plugin-4.2.0` — source of **Lesson Track 2** ("frequency pairs": two new letters per lesson by frequency, real words from lesson 3), the adaptive engine, and all 16 arcade games. (4.1.1 was a strict subset of 4.2.0 and is not kept.)

Story, characters and the scene list are in `docs/GAME_DESIGN.md`. Look and feel is in `docs/DESIGN.md`.

## 1. Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language / build | TypeScript strict + Vite, pnpm 10, Node 20+ | Static output, fast, one build for web and plugin |
| 3D | Three.js (plain, no React) | Smallest bundle; the plugin must stay light |
| Post-processing | `postprocessing` (pmndrs): bloom, vignette, tone mapping, chromatic aberration on hits, optional SSAO on high/ultra | One merged pass, cheap on integrated graphics |
| Physics | None as a library; small custom kinematics in `src/engine/motion.ts` | Typing drives everything; a physics engine (Rapier is 1.5 MB of WASM) buys nothing and hurts the plugin |
| UI | Plain TypeScript + DOM overlay, CSS custom properties (tokens) | No framework weight; RTL handled by `dir` + logical CSS properties |
| Audio | Web Audio API, fully procedural (synth music stems, key clicks, SFX) | Zero audio files: offline, tiny, adaptive by nature |
| Voice | Browser speech synthesis when a matching voice exists; subtitles always | No recorded assets |
| Art | Procedural low-poly geometry and shader materials made in code; fonts from `@fontsource` (OFL) | No downloads, no licences to chase; every asset listed in `ASSETS.md` |
| Saves | `SaveStore` interface with two adapters: `localStorage` (web) and `Otzaria.call('storage.get'/'storage.set')` (plugin) | Same game, two homes |
| Tests | Vitest (logic), Playwright (one smoke test per scene, 1280×720 and 375px menus) | CI proves every scene loads |
| Hosting | Vercel static (preview per branch, `main` = live) | Same as Vodock; free plan |
| Plugin | `pnpm build:plugin` → relative-path build + `plugin/manifest.json` zipped to `dist-plugin/otiyot-<version>.otzplugin` | Otzaria loads `index.html` from a folder, offline |

Env vars: none. There are no secrets in this project.

## 2. Folder structure

```
src/
  core/          typing engine, pure TS, no DOM: layouts (he/en), session, per-key metrics, scoring
  learn/         lesson tracks (track1, track2), word library, adaptive model, spaced repetition
  save/          schema + migrations, SaveStore adapters, legacy import, JSON export/import
  engine/        renderer, quality presets, post FX, scene manager, camera rig, VFX kit, character rig, motion
  audio/         synth, music stems, SFX, mixer (music / effects / voice / UI volumes)
  game/          combat (word shields), combo, difficulty, bosses, progression, economy
  story/         dialogue + cutscene player, script data (he/en), characters
  scenes/<id>/   one folder per scene; index.ts exports a GameScene (see below)
  ui/            menus, HUD, settings, dashboard, journal, 3D keyboard overlay; i18n loader
  arcade/        host that embeds the legacy games
  main.ts        boot: detect Otzaria vs web, load save, show title
public/arcade/   the legacy plugin games (plain JS from reference/plugin-4.2.0), run inside an iframe
locales/         he.json, en.json — every UI string
plugin/          manifest.json, pack script
reference/       the original plugins. READ-ONLY. Never edit, never import from src/
tests/unit, tests/e2e
docs/            this file, ROADMAP, DESIGN, GAME_DESIGN, progress.json, PROGRESS.md, auto-run/
```

**Scene contract** (`src/engine/scene.ts`, built in T08). Every scene is self-contained so a task only needs its own folder plus the kits:

```ts
interface GameScene {
  id: string;                       // 'meadow', 'cliffs', ...
  load(ctx: SceneContext): Promise<void>;   // build geometry, lights, music theme
  start(run: RunConfig): void;      // lesson/drill text source, difficulty, seed
  update(dt: number): void;
  onKey(ev: TypedKey): void;        // already judged by core: correct / wrong / expected char
  dispose(): void;                  // free every geometry, material, texture
}
```
`SceneContext` gives the scene the renderer, camera rig, VFX kit, audio, HUD and a `TextSource` (words chosen by the lesson track + adaptive engine). A scene never reads the keyboard or the save file directly.

## 3. Users

No accounts. Multiple local **profiles**; each has its own settings, skill model, progress, chosen lesson track and layout. One profile is active at a time.

## 4. Data model (save file, versioned)

`Save { version, profiles[], activeProfileId, meta { legacyChecked } }`. `Profile { id, name, avatar, settings, track: 1|2, layout: 'he'|'en', lessons{ [track]: progress }, keys{ [char]: KeyStat }, srs, story{ scene ranks, flags }, wallet{ glyphs, ink }, unlocks, cosmetics, history[] (sessions), customLists{ [id]: { name, language, words[] } } (v2, T05), arcade (opaque blob owned by the legacy games), createdAt }`. `KeyStat { hits, misses, avgMs, lastSeen, ease, due, confusions{} }`. `settings` holds `uiLanguage`, volumes (music, effects, and since v6 (T10) voice and menu sounds), backspace policy, niqqud mode, hardcore, reduced motion and, since v3 (T07), the display options `theme` (`auto`/`light`/`dark`), `colorblind`, `highContrast`, `largeText`, `dyslexiaFont`. Since v4 (T08) `settings.quality` is the graphics preset (`auto`, `low`, `medium`, `high`, `ultra`) and `meta.autoQuality` remembers what the first-run benchmark picked for this device (`null` until it has run). Since v5 (T09) `settings.keyboardGuide` is the keyboard under the play view: `keys` (default), `hands` (keys and hands) or `off`. Since v7 (T12) `settings.textSpeed` (`slow`, `normal`, `fast`, `instant`) sets how fast story lines appear and `settings.storyVoices` (off by default) reads them aloud; `story.flags.intro` is true once the opening has been seen. Every schema change adds a migration in `src/save/migrations.ts` with a unit test. Typed text itself is never stored, only statistics.

## 5. Lesson tracks

- **Track 1 — "Letter by letter"** (from 3.3.0): levels Getting Started → Individual Letters (home row first) → Letter Combinations → Short Words → Words & Sentences → Paragraphs → Advanced → Niqqud → Mastery.
- **Track 2 — "Words from the start"** (from 4.2.0): same level names, but level 1 teaches two new letters per lesson in frequency order and uses real words from lesson 3.
- Both exist for Hebrew and English. The player picks a track per profile (first run and in Settings) and can switch any time; progress is kept per track. Per-key skill data is shared between tracks.
- **Code (T04).** `src/learn/track.ts` holds `TRACK_1` and `TRACK_2` (levels, lessons, unlock rule, "continue"); text generators are `text1.ts` (3.3.0) and `text2.ts` (4.2.0) and take an injected random source, so lessons are reproducible. Word banks and the lexicon in `src/learn/data/` are generated from `reference/` by `scripts/extract-learn-data.mjs`. Progress lives in `profile.lessons`: key `"1"`/`"2"` for Hebrew and `"1-en"`/`"2-en"` for English (`src/learn/progress.ts`); switching tracks only changes `profile.track`. `nextText(profile, {level, lesson?})` in `src/learn/source.ts` is what scenes call. Weak keys and weak transitions are passed in by the adaptive engine (T06). Tests run the original plugin code in a sandbox and compare lessons text for text.
- Story scenes ask the active track for text: each scene maps to a band of the track (see GAME_DESIGN), so the story *is* the course. A key set unlocks only when accuracy on the current one passes the threshold (default 90%).

- **Adaptive engine (T06).** `src/learn/adaptive.ts`, pure logic, time and randomness injected. Per-key stats stay in `profile.keys`; spaced-repetition state lives in `profile.srs` as `{skills, pairs, challenge}` (plain JSON, so no save migration): `skills[ch]` holds successes, failures, retention checks, miss streak and `nextReview`; `pairs["ab"]` the same for letter transitions; `challenge` the rolling 300-keystroke accuracy and difficulty level 0..1 (the 85% rule: up above 96%, down below 92%). `recordKeystroke` returns new `keys`/`srs` (no mutation). `weakCharacters`, `weakBigrams`, `topErrorPairs`, `fingerSkills`, `dueToday` (review ladder 1/3/7/14/30 days), `unlockGate` (opens new keys when no learned key scores under 70), generators `generateCharDrill` (weak share bounded to 15-50%), `generateBigramDrill`, `generateErrorDrill`, `generateWordDrill`, and `buildMicroLesson(profile, minutes, now, rng)`. `contextFor` in `source.ts` now fills weak keys, weak transitions and difficulty from `adaptiveOptions(profile)` unless the caller passes them. Callers feed `recordKeystroke` per key and must save the returned `keys` and `srs`.
- **Word library (T05).** `src/learn/library/` holds themed word packs and sentence packs per language (`data-he.ts`, `data-en.ts`, drafted by a helper model and reviewed) plus the older lexicon as the `classic` pack. API: `wordsOf`, `sentencesOf`, `tierOf` (1-3, 4-5, 6-7, 8+ letters), `eligibleWords` / `pickWords` (allowed key set, length, tier, pack, weights toward weak keys), and custom lists (`parseWordList`, `setCustomList`, `removeCustomList`) stored on `profile.customLists`. `tests/unit/library-content.test.ts` scans every pack against the content rules (blocklist of holy Names).

## 5b. UI shell and design system (T07)

- **Tokens.** `src/ui/styles/tokens.css` is the only file that may contain a raw color, size, radius or shadow. Raw colors are declared for light and dark; everything mixed from them (gold tints, shadows, scrim) is in one "derived" block that is re-evaluated inside any element carrying `data-theme`, so themes can be nested. `src/engine/palette.ts` mirrors the colors for 3D; `tests/unit/ui-tokens.test.ts` fails if tokens.css, palette.ts and the DESIGN.md table ever disagree, or if another stylesheet writes a raw color.
- **Switches** live as data attributes on `<html>`, set by `src/ui/theme.ts` from the active profile's settings: `data-theme`, `data-palette="cb"`, `data-contrast="high"`, `data-text="large"`, `data-font="dyslexia"`, `data-motion="reduce"`. `lang` and `dir` are set by the i18n loader.
- **Fonts** are `@fontsource` packages, declared by hand in `src/ui/styles/fonts.css` (woff2 only, Hebrew + Latin subsets, only the weights used) to keep the plugin small.
- **i18n.** `src/ui/i18n.ts`: `I18n` (live language, `t(key, vars)`), `translate`, `dirOf`, and the mixed-direction helpers `isolate` (Unicode isolates for strings), `bdi` (DOM) and `textDir`. Every inserted value is isolated, so a Latin name inside a Hebrew sentence cannot reorder it. Keys are typed from `locales/en.json`; a test keeps both files in step.
- **Components** (`src/ui/components`): button, field, toggle, slider, select, tabs, panel, keycap, status, statTile, progressBar, rankBadge, toastHost, openModal, dialogueBox, keyboardMap (also the key heatmap), lineChart, choiceCard/choiceGroup (track picker card), menu. They are plain functions that return elements; all text is passed in.
- **Typed menus.** `src/ui/hotkeys.ts` (pure) gives each menu item a letter and decides what a key press means. The typed character wins; otherwise the physical key is looked up on both layouts, so a Hebrew menu works while the computer keyboard is set to English and the other way round.
- **Shell.** `src/ui/shell.ts` owns the top bar (back, player, language, theme), one `keydown` listener, and screen switching by location hash (`#/title`, the launch screen when there is no hash; `#/intro`, the opening cutscene; `#/menu`, `#/players`, `#/players/new`, `#/track`, `#/layout`, `#/settings`, `#/pause`; `#/range`, the 3D test range, by address only; `#/styleguide` in dev only). A screen is a factory `(ctx: AppContext) => Screen` in `src/ui/screens`; `AppContext` gives it the save manager, i18n, toasts and navigation. Launch opens the 3D title; a fresh save's "Begin the story" opens the three-step welcome (name, keyboard, track), which hands over to the intro. Where the story hands over ("the hub") is `HUB` in `src/ui/app.ts`: the main menu until T13 builds the House of the Scribe. A screen may take Esc for itself with `onEscape` (the intro skips). Scenes will open the pause menu with `openPauseMenu(ctx, handlers)`.

## 6. Arcade (the 16 earlier games)

The legacy games are kept as they are (plain JS, global `THREE`) under `public/arcade/` and run in an iframe opened from the hub's Game Room. A small bridge (`postMessage`) gives them: the active profile's weak keys and word source, the layout, the theme tokens, and save/load of their own blob. They are regrouped in one lobby: **3D Classics** (Galaxy, Sefarim, Race, Arena, Tower), **New Generation** (Letter Dash, Rhythm, Fortress + the perk/coin/daily layer), **Quick Games** (the 2D games, Storm). They are not rewritten.

## 7. Performance

Target 60 fps at 1080p on integrated graphics (Intel Iris Xe). Presets low / medium / high / ultra change: pixel ratio cap, shadow map size (one cascaded sun on high+, blob shadows on low), post FX set, particle counts, fog quality. Default is picked by a 2-second benchmark on first run. Budgets per scene on medium: ≤ 150 draw calls, ≤ 300k triangles, no allocations in `update()`. Instancing for anything repeated. Every scene disposes what it creates.

## 7b. 3D engine kit (T08)

Everything a scene needs lives in `src/engine` and is imported from `src/engine/index.ts`. A scene never creates a renderer, a light rig or a shader of its own.

- **Engine** (`engine.ts`). One WebGL renderer, one camera, one fixed-step loop (`loop.ts`: logic always advances in 1/60 s steps; hit-stop freezes the world while the screen keeps drawing). `Engine.create(element, { quality, reducedMotion })`, `setQuality`, `benchmark()` (2 seconds, picks a preset from frame times, see `quality.ts`), `simulate(seconds)` for tests, `stats` (fps, draw calls, triangles, GPU object counts) and `dispose()`, which returns what the renderer still holds (must be all zero). Throws `NoWebGLError` when the device cannot draw 3D.
- **Quality** (`quality.ts`, pure). `low`: pixel ratio 1, blob shadows, bloom only. `medium`: one sun shadow map, god rays, chromatic pulse, 2x MSAA. `high`: three cascaded shadow maps, SSAO, 4x MSAA. `ultra`: the same at pixel ratio 2 with the largest pools. `BUDGET` (150 draw calls, 300k triangles) is judged on medium; the perf overlay (`perf.ts`) turns a number red when it is over.
- **Materials** (`materials.ts`). Every surface comes from `MaterialKit.surface()` so three things work everywhere for free: the color-restoration sweep (forgotten things are grey `--fade`, color spreads from a point with a gold wavefront; up to 6 sweeps at once, `restoreAll`, `clearSweeps`), height fog with sun in-scatter, and flat-shaded low-poly lighting. On the night-ink theme the forgotten grey is lifted to a readable moonlit level.
- **Atmosphere** (`lighting.ts`). A scene hands over a `ScenePalette` (sky, one hero sun, fill, fog) and gets sky dome, sun, fill light, fog and the right shadows for the preset. `setShadowRange`, `groundAt` for blob shadows.
- **Post FX** (`postfx.ts`, built on the `postprocessing` library). Bloom, screen-space god rays, SSAO, then one finishing pass: chromatic-aberration hit pulse, tone mapping, color grading (`setGrade`), screen flash, vignette. One full-screen pass on low, two otherwise.
- **Camera rig** (`camera.ts`). `follow` (third person with collision against boxes the scene registers), `rail` (along a curve) and `cockpit`; `shake`, `pushIn`; switching mode glides. With reduce-motion on, shake, push-in, screen flash, the chromatic pulse and hit-stop are all switched off (`Engine.setReducedMotion`).
- **VFX kit** (`vfx.ts`). Pooled and animated on the graphics card, one draw call per effect type: `burst` (glow or ink particles, styles made with `burstStyle`), `trail` (ink ribbon), `shatter` (a letter breaks into fragments), `shockwave`, `restore` (the sweep), `flash`, and `impact` (flash + shake + chromatic pulse + hit-stop together).
- **Letters** (`letters.ts`). `LetterAtlas` draws every glyph once into one texture; `LetterField` shows many letters in one draw call, each with its own place, size, color and glow.
- **Characters** (`character.ts`, `characterAnim.ts`). `Character` builds a modest robed figure from a `CharacterLook` (robe, hem, trim, skin, headwear: cap, brimmed hat or turban, beard, height); every figure is a man (section 8). `Animator` (pure) blends idle, walk and run by speed and lays `write`, `hit`, `stagger`, `fall` or `cheer` on top; an interrupted action never snaps.
- **Scenes** (`scene.ts`). `SceneManager.go(scene, run)` covers the screen with the ink wipe (`transition.ts`), disposes the old scene, loads and starts the new one, and uncovers. `SceneContext` gives a scene: `engine`, `root` (its own group), `tracker`, `materials`, `atmosphere`, `post`, `rig`, `vfx`, `audio` (the T10 audio engine, see 7d; `SILENT_AUDIO` when a host passes none), `hud` and `typing` (T09), `theme` and `color(token)`. Everything a scene creates goes through `ctx.tracker` (`disposal.ts`); after `dispose()` the manager checks that nothing was left (`lastLeak`).
- **Test range** (`src/scenes/range`, screen `#/range`, reached by address only). Shows every effect, camera mode, animation and preset with the perf overlay, and is the first real `GameScene` to copy from. Its words come from `learnedWordSource(profile, { rng, minLength, maxLength })` in `src/learn/source.ts`: real library words spelled only with the keys the profile has learned, or short drills of those keys while too few are learned (section 8, learned letters only). `tests/e2e/range.spec.ts` runs the whole tour and fails if a single GPU object is left after closing it.

## 7c. Typing in play (T09)

- **Flow.** The screen that runs a scene owns a `PlayController` (`src/ui/play.ts`). A key press goes: keyboard event -> `TypingDriver.press` (`src/game/typing.ts`, which judges it with the core `TypingSession`) -> HUD, keyboard guide and hint coach update -> `SceneManager.onKey(judged)` -> `scene.onKey`; a finished word also goes to `SceneManager.onWord` -> `scene.onWord(word, perfect)`. Scenes never see raw keys.
- **TypingDriver** (pure, tested). Turns a `TextSource` into words; each word is typed with the space after it, and that space finishes it (the last word of a lesson has none). Modes: `endless` (keeps asking the source) and `once` (one whole lesson, then `ended`). Keeps the letter states of the word (`todo`, `next`, `ok`, `fixed`, `err`), the lookahead word, the combo and best combo (`comboTier`: 0 ink, 10 techelet, 25 silver, 50 gold, 100 light), rolling 15-second WPM, accuracy and the run's `metrics`. `guide()` is the key to press now: the next letter's physical key, its finger and the Shift on the other hand, or Backspace when the backspace policy is `mustFix` and a mistake must be fixed first. Backspace policy, hardcore and niqqud come from the profile's settings.
- **SceneContext.typing** (`TypingView`) lets a scene draw the word in its world (letters, states, position, combo tier) without judging anything. `NO_TYPING` when the host types nothing.
- **HUD** (`src/ui/hud.ts`, DOM over the canvas, `hud.css`). Combo meter top centre (grows with the streak, changes material per tier), WPM and accuracy in the top corner, the paper strip in the lower third (current word letter by letter, the next word dimmed, the lesson's progress), gentle tips above it, gold announcements. Each word gets its own direction, so Hebrew reads right to left and a Latin word inside it keeps its order. It also implements the scene-facing `HudPort`.
- **Keyboard guide** (`src/ui/keyboardGuide.ts`). A tilted keyboard drawn with CSS 3D transforms (crisp glyphs, token colors, no extra WebGL context), always physical left to right, in the active layout with the other layout's letter small in the corner. Keys are coded by finger color (`--finger-*` tokens), the next key rises and glows techelet, the Shift to hold glows with it, every press dips the key (gold when right, red when wrong), and optional hands lift the finger to use. A caption names the key and finger. `settings.keyboardGuide` picks keys, keys and hands, or hidden.
- **Hint coach** (`src/game/hints.ts`, pure). After a mistake, reads the core's `inferHints` over the last 40 keys and may show one tip: wrong finger (names the finger) or hands drifting off the home row. At most one tip per 25 seconds and the same tip at most once per 90 seconds.
- **3D feedback** (`src/game/feedback.ts`, `TypingFeedback`). Correct key: a gold ink stroke across the letter, sparks and ink drops, a small knock and chroma pulse that grow with the combo tier. Wrong key: a small stumble and a desaturate flicker (`PostFx.setSaturationScale`; one slow dip with reduce motion). Finished word: a ring of gold, a shockwave and a full impact. Allocates nothing per frame.
- **World text** (`src/engine/worldText.ts`, `WorldText`). The word standing in the world in three looks: `carved` (light letters on a stone tablet), `banner` (ink on a glowing parchment banner on a gold rod) and `hologram` (light letters in a flickering techelet frame). Letters follow the typing states (next glows techelet, typed turn gold and pop, wrong stumble red), lay right to left for Hebrew (`letterOffset`), and face the camera. One draw call for the letters.
- **Test range.** Types the learner's current lesson (`nextContinueText`, a summary card at the end, Enter for the next) or endless learned words, and switches text style and guide mode from its panel. The e2e test types whole lessons in English and Hebrew by pressing exactly what the guide shows.

## 7d. Audio (T10)

Everything is made in code with Web Audio (`src/audio`); there are no sound files.

- **AudioEngine** (`engine.ts`). One per app, made by the shell and handed to screens as `AppContext.audio` and to scenes as `SceneContext.audio` (the `AudioPort`). Browsers allow sound only after a gesture, so nothing is created until the first key press or click (`unlock()`); before that, the wanted theme is remembered and one-shots are dropped. Sound pauses while the tab is hidden. `status` is a snapshot for the sound room and tests; `AudioEngine.render(theme, seconds, intensity)` renders a theme offline.
- **Mixer.** Four buses with the player's volumes (`musicVolume`, `sfxVolume`, `voiceVolume`, `uiVolume`, squared curve `volumeToGain`): music goes through a ducker (dips a little under errors and impacts), all into a master and a soft limiter; music and effects send to one hall reverb made from decaying noise. `voiceVolume` is also exposed for speech synthesis (T35), which plays outside Web Audio.
- **Adaptive music** (`themes.ts` data, `composer.ts` pure, tested). A theme has a mode (freygish, minor, dorian, mi sheberach), root, tempo, grid (eighths, 6/8 or sixteenths), a form of 8-bar sections, instruments and drum patterns. The composer writes every bar of five stems: **drone** (tonic pedal and bass), **pulse** (the chord's arpeggio), **melody** (4-bar phrases following a contour: statement rises, answer leans on the dominant, the section's last phrase comes home to the tonic; the skeleton repeats so the tune is recognisable, grace-note ornaments change on every visit so it never loops exactly), **counter** (a second voice leading to the next chord) and **percussion** (darbuka, frame drum, taiko or brushes; fills at the top level). `stemLevels(intensity)`: drone and soft pulse always, melody from 0.25, drums from 0.5, second voice from 0.75, busier drums at 1; `tierIntensity(tier)` maps the combo tiers onto that. The `BarClock` holds intensity, section and boss-phase requests until the next bar line; stems fade over one beat. A scheduler writes about 0.18 s ahead.
- **Themes.** `title` (D freygish, 60, clarinet, 6/8), `hub` (G minor, 80, oud and brushes, swung), `meadow` (A dorian, 112, flute and darbuka), `cliffs` (E mi sheberach, 92, violin and kanun, 6/8), `boss` (C freygish, 138, strings, cello ostinato, taiko; `section('phase1'|'phase2'|'phase3')`, the last a semitone higher). Menus play `title` at 0.3; a screen with `ownsMusic` or `full` picks its own.
- **Instruments** (`synth.ts`): pad, harp, oud, kanun, flute, clarinet, violin, strings, cello, bell, and the drum kits.
- **Effects** (`sfx.ts`, `SFX_NAMES`): `key` (a wooden tap coloured per character plus a note that climbs the theme's pentatonic ladder with the combo, up two octaves and back, brighter per tier), `space`, `error` (a low muted knock), `word`, `perfect`, `restore`, `tier`, `impact`, `impact-small`, `shatter`, `whoosh`, `success` and the menu sounds `ui-move`, `ui-click`, `ui-back`, `ui-open`, `ui-toggle`, `ui-error` (on the menu bus; the shell plays them on clicks, keyboard moves and Back).
- **Ambience and position** (`ambience.ts`). `ambience(id, x?, y?, z?)` starts a loop (`wind`, `birds`, `water`, `fire`, `crickets`, `hum`) and returns a handle (`move`, `stop`); with a position it pans and fades with distance (HRTF panner). `playAt(sound, x, y, z)` does the same for one-shots. The scene manager points the ears along the camera every frame and stops all ambience when a scene unloads.
- **Sound room** (`#/sound`, from Settings > Sound): every theme, a streak-level slider, lamps for the stems playing, a typing pad that builds a real streak, boss phases, places and every effect.

## 7e. Combat kit (T11)

Shared by every action scene; pure logic in `src/game` (unit-tested), one 3D view on top.

- **Difficulties** (`difficulty.ts`, data). `calm` (no timers: Blots come close and wait, never reach the scribe), `steady`, `swift`, `fierce`, `trial` (Sofer's Trial: the first error ends the run). Each sets enemy pace, spawn gap, most Blots on the field, combo tiers lost on an error and on a smudge, extra word length, reward multiplier and the speed that counts for rank S.
- **Levels** (`levels.ts`). Every run takes `easy`, `standard` or `hard`: word lengths, waves, Blots per wave and growth, speed pressure. Words come from `levelWordSource(profile, level, difficulty, rng)`, which is `learnedWordSource` with the level's lengths, so only learned keys appear. Standard opens at 10 learned letters, Hard at 18 (`levelsFor(profile)`). `suggestLevel(recent, current, unlocked)`: about 90% accuracy with rising speed suggests one level up, under 82% one down, never a locked one. Fights write a statistics-only history entry (`mode: 'fight:<level>:<difficulty>'`) that feeds the suggestion.
- **Combo rules** (`combo.ts`). `ComboRules` is the `ComboPolicy` the typing driver asks on every letter (`DriverOptions.combo`): an error drops the streak to the floor of a lower tier (`dropTiers`) instead of zero; Steady Hand (`steadyHand` charges, refilled at each new tier) absorbs errors outright (hook for T33). `tierPower` and `tierVfx` scale hits and effects per tier; music follows `tierIntensity` as before.
- **Wave fight** (`combat.ts`, `WaveFight`). Blots in a fixed pool of 8, each `{word, typed, angle, dist (1 = edge, 0 = scribe), speed, size, locked}`. `planWaves(level, difficulty, seed)` lays out the waves with spawn patterns `arc`, `pincer`, `stream`, `scatter`, `pairs` (same seed, same fight; the last Blot of later waves is a big one). Blots on the field always start with different letters. It implements `Targeting`: `PlayController.begin(..., { targeting, combo, hardcore })` lets the first letter of a word pick the Blot to lock onto (`TypingDriver.retarget` swaps the word before its first letter), and after each word the nearest Blot becomes the next target. Events go to a `CombatListener`: `spawn`, `lock`, `hit`, `broken`, `smudge`, `wave`, `cleared`. A Blot that reaches the scribe smudges him (the streak drops by the difficulty's smudge tiers) and is thrown back.
- **Results** (`results.ts`). `rankOf`: accuracy alone decides A (94), B (88) or C; S needs 98% and the difficulty's speed; a failed Trial is C. `rewardsOf`: XP from words and shields, glyphs from shields times accuracy cubed, ink from the best streak, scaled by difficulty and level. Not yet added to the wallet (T33).
- **BlotField** (`blots.ts`, 3D). Draws a `WaveFight` in any scene from a centre, a facing and a radius: lumpy ink bodies with pale eyes (one mesh each), a geodesic glass shield that turns gold as its word is typed, the word on a parchment banner (first letter glowing so the player sees what to type), a turning gold ring under the locked Blot, ink bolts from the quill on every letter, and on a break: the letters shatter in gold, ink drops, a shockwave, and color sweeps back over the ground there. Sizes grow with the combo tier.
- **Sandbox.** The test range (`#/range`) has a **Wave fight** mode: pick a difficulty and a level (locked levels say why; the suggested one has a star), fight three to five waves, and get a results card with rank, accuracy, speed, best streak, shields, XP, glyphs and ink; Enter fights again. `tests/e2e/fight.spec.ts` plays a whole Calm fight by following the guide.

## 7f. Story (T12)

- **Data** (`src/story`, pure, unit-tested). A `Cutscene` is a list of `Beat`s: an optional named camera `shot`, a scene `cue` (an effect, a walk, a sign going blank), `act` (Animator actions for named actors), an optional `say` line `{ who, text: { he, en } }`, and `seconds` (how long a silent beat lasts, or the least a line beat lasts). `CAST` names every speaker in both languages, with a portrait kind and an optional speech voice (pitch, rate); the apprentice is silent. `APPRENTICE_LOOKS` are the player's looks (male apprentices only), picked by `profile.avatar`. Scripts live beside it (`intro.ts`: the opening of Act 1, `ACT_ONE`, `SIGN_TEXT`).
- **CutscenePlayer** (`player.ts`). Walks the beats; reveals each line letter by letter at the text speed (`CHARS_PER_SECOND`; a breath after punctuation, `letterCosts`), waits for the player once a line is all there, `advance()` shows the rest or moves on (a second press within `ADVANCE_GUARD` is ignored), `skip()` ends it. Silent beats move on by themselves and cannot be hurried. Events: `beat(beat, index)` and `end(skipped)`. The scene drives it from its fixed `update`, so lines, cues and camera never drift apart.
- **Staging** (a scene, e.g. `src/scenes/intro`). Implements `onBeat` (frames the named shot, plays the cue and the actions) and eases the camera along the shot with `rig.fixed`; a far jump between shots is a cut, a near one glides. Line beats drift the camera over at least seven seconds since they wait for the reader.
- **Screen** (`src/ui/screens/intro.ts`). Owns the player and the dialogue box (`dialogueBox` with a portrait per speaker, the line typing itself out with `reveal`, a pulsing continue key with `setWaiting`), letterbox bars, a Skip button, the act card, and `StoryVoice` (`src/ui/voice.ts`: the device's own speech voices, `localService` only so nothing goes over the network). Enter or Space continues, a click on the box too, Esc skips. At the end it sets `story.flags.intro` and goes to `HUB`. Without 3D the same lines play over the parchment.
- **Title** (`src/scenes/title`, `src/ui/screens/title.ts`). Gold-ink letters fall onto a forgotten (grey) parchment and spell אותיות, then OTIYOT; each landing splashes ink and sweeps color back; the camera flies in low across the page and rises to face the name; loose grey letters drifting above turn gold once the name is whole. Any key or click jumps to the finished picture and the choices (Begin, Continue, Watch the opening again, Players, Settings). `src/ui/stage3d.ts` (`mountScene`) is the small host both screens share.
- **Sidekick** (`src/game/dyo.ts`). Dyo, the ink drop: a glossy teardrop with big eyes that breathes, blinks, hops with squash and stretch (`hop`, then turns to face a point), `cheer`s and `face`s things. For any scene.
- **Tests.** `tests/unit/story.test.ts` (reveal, advance, skip, the whole intro played through, both languages, content filter on every line, the cast); `tests/e2e/story.spec.ts` (title, begin, a line types out and advances, Esc skips to the menu, the flag is remembered, nothing left on the graphics card).

## 8. Content rules

- **No women, no sexualized content, anywhere.** No female characters, figures, silhouettes, voices, portraits or NPCs in any scene, cutscene, menu, cosmetic, journal entry or arcade game. All human characters (the player's apprentice, mentor, rival, merchants, crew, librarian, the Keeper) are male, and non-human characters (Dyo the ink drop, animals, machines, drones, letters) are fine. Nothing sexy, suggestive, romantic or flirtatious in visuals, text, jokes or word lists. The player's look options are male apprentices only (different robes, caps, quills, colors). The word and sentence packs must not contain words that point to women, romance or intimacy, and a unit test scans every pack against a blocklist. If an old arcade game from `reference/` draws or names a woman, it is changed or left out.
- Family-safe and modest throughout: characters dress modestly, no romance, no crude humor, nothing graphic. Tension is fine (the Lantern Caves are tense, not horror).
- Jewish culture as the setting: the alef-beis, sofer's tools, places in Eretz Yisrael, holidays, gematria, atbash, proverbs and everyday words. No holy Names anywhere (use ה׳ only if unavoidable), no full pesukim as typing text, no depiction of anything sacred being damaged, and no theology or debate.
- **Learned letters only.** Typing text in any scene, mode or arcade game uses only the keys the active profile has already learned in the active lesson track (plus space and the punctuation already learned). A key that has not been unlocked never appears in text to type. The only place a new key appears is the lesson that teaches it, where the guide shows it and drills it alone. See GAME_DESIGN 'Levels follow your learning'.
- Hebrew is the primary language of the world; English is a full second language for UI and typing.

## 9. Safety guardrails

No network requests at runtime. No analytics. No typed content stored. Online features (duels, global leaderboards, Supabase) are **not** in this roadmap; see ROADMAP "Later".

## 10. Decisions made from the brief (open to change)

| Decision | Why |
| --- | --- |
| Three.js + Vite, not Unity/Godot | Must run inside Otzaria as a web plugin and on the web from one build |
| No Rapier | See stack table |
| No Next.js / Supabase / logins (differs from Vodock's stack) | A static offline game needs none of it; the Vodock *method* is kept |
| Procedural art and audio only | Offline, small, no licences; quality comes from lighting, color, motion and post FX |
| Legacy games embedded, not rewritten | ~400 KB of working game code; rewriting costs a lot and adds nothing |
| Online duels and global leaderboards moved to "Later" | Need accounts and a server; ghosts and daily seeds work locally |
| Controller support dropped | It is a typing game |
| Fable builds everything that needs taste (visuals, 3D, feel, story, music); Sonnet builds mechanical tasks | Owner's instruction |
