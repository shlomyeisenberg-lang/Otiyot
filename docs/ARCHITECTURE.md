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

`Save { version, profiles[], activeProfileId, meta { legacyChecked } }`. `Profile { id, name, avatar, settings, track: 1|2, layout: 'he'|'en', lessons{ [track]: progress }, keys{ [char]: KeyStat }, srs, story{ scene ranks, flags }, wallet{ glyphs, ink }, unlocks, cosmetics, history[] (sessions), customLists{ [id]: { name, language, words[] } } (v2, T05), arcade (opaque blob owned by the legacy games), createdAt }`. `KeyStat { hits, misses, avgMs, lastSeen, ease, due, confusions{} }`. Every schema change adds a migration in `src/save/migrations.ts` with a unit test. Typed text itself is never stored, only statistics.

## 5. Lesson tracks

- **Track 1 — "Letter by letter"** (from 3.3.0): levels Getting Started → Individual Letters (home row first) → Letter Combinations → Short Words → Words & Sentences → Paragraphs → Advanced → Niqqud → Mastery.
- **Track 2 — "Words from the start"** (from 4.2.0): same level names, but level 1 teaches two new letters per lesson in frequency order and uses real words from lesson 3.
- Both exist for Hebrew and English. The player picks a track per profile (first run and in Settings) and can switch any time; progress is kept per track. Per-key skill data is shared between tracks.
- **Code (T04).** `src/learn/track.ts` holds `TRACK_1` and `TRACK_2` (levels, lessons, unlock rule, "continue"); text generators are `text1.ts` (3.3.0) and `text2.ts` (4.2.0) and take an injected random source, so lessons are reproducible. Word banks and the lexicon in `src/learn/data/` are generated from `reference/` by `scripts/extract-learn-data.mjs`. Progress lives in `profile.lessons`: key `"1"`/`"2"` for Hebrew and `"1-en"`/`"2-en"` for English (`src/learn/progress.ts`); switching tracks only changes `profile.track`. `nextText(profile, {level, lesson?})` in `src/learn/source.ts` is what scenes call. Weak keys and weak transitions are passed in by the adaptive engine (T06). Tests run the original plugin code in a sandbox and compare lessons text for text.
- Story scenes ask the active track for text: each scene maps to a band of the track (see GAME_DESIGN), so the story *is* the course. A key set unlocks only when accuracy on the current one passes the threshold (default 90%).

- **Adaptive engine (T06).** `src/learn/adaptive.ts`, pure logic, time and randomness injected. Per-key stats stay in `profile.keys`; spaced-repetition state lives in `profile.srs` as `{skills, pairs, challenge}` (plain JSON, so no save migration): `skills[ch]` holds successes, failures, retention checks, miss streak and `nextReview`; `pairs["ab"]` the same for letter transitions; `challenge` the rolling 300-keystroke accuracy and difficulty level 0..1 (the 85% rule: up above 96%, down below 92%). `recordKeystroke` returns new `keys`/`srs` (no mutation). `weakCharacters`, `weakBigrams`, `topErrorPairs`, `fingerSkills`, `dueToday` (review ladder 1/3/7/14/30 days), `unlockGate` (opens new keys when no learned key scores under 70), generators `generateCharDrill` (weak share bounded to 15-50%), `generateBigramDrill`, `generateErrorDrill`, `generateWordDrill`, and `buildMicroLesson(profile, minutes, now, rng)`. `contextFor` in `source.ts` now fills weak keys, weak transitions and difficulty from `adaptiveOptions(profile)` unless the caller passes them. Callers feed `recordKeystroke` per key and must save the returned `keys` and `srs`.
- **Word library (T05).** `src/learn/library/` holds themed word packs and sentence packs per language (`data-he.ts`, `data-en.ts`, drafted by a helper model and reviewed) plus the older lexicon as the `classic` pack. API: `wordsOf`, `sentencesOf`, `tierOf` (1-3, 4-5, 6-7, 8+ letters), `eligibleWords` / `pickWords` (allowed key set, length, tier, pack, weights toward weak keys), and custom lists (`parseWordList`, `setCustomList`, `removeCustomList`) stored on `profile.customLists`. `tests/unit/library-content.test.ts` scans every pack against the content rules (blocklist of holy Names).

## 6. Arcade (the 16 earlier games)

The legacy games are kept as they are (plain JS, global `THREE`) under `public/arcade/` and run in an iframe opened from the hub's Game Room. A small bridge (`postMessage`) gives them: the active profile's weak keys and word source, the layout, the theme tokens, and save/load of their own blob. They are regrouped in one lobby: **3D Classics** (Galaxy, Sefarim, Race, Arena, Tower), **New Generation** (Letter Dash, Rhythm, Fortress + the perk/coin/daily layer), **Quick Games** (the 2D games, Storm). They are not rewritten.

## 7. Performance

Target 60 fps at 1080p on integrated graphics (Intel Iris Xe). Presets low / medium / high / ultra change: pixel ratio cap, shadow map size (one cascaded sun on high+, blob shadows on low), post FX set, particle counts, fog quality. Default is picked by a 2-second benchmark on first run. Budgets per scene on medium: ≤ 150 draw calls, ≤ 300k triangles, no allocations in `update()`. Instancing for anything repeated. Every scene disposes what it creates.

## 8. Content rules

- Family-safe and modest throughout: characters dress modestly, no romance, no crude humor, nothing graphic. Tension is fine (the Lantern Caves are tense, not horror).
- Jewish culture as the setting: the alef-beis, sofer's tools, places in Eretz Yisrael, holidays, gematria, atbash, proverbs and everyday words. No holy Names anywhere (use ה׳ only if unavoidable), no full pesukim as typing text, no depiction of anything sacred being damaged, and no theology or debate.
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
