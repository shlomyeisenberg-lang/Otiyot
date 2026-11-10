# Otiyot — Design

## Feel

1. **Ink on parchment, lit from within.** The world is a manuscript coming back to life: warm paper, deep ink, gold leaf, and one living blue. Grey means forgotten; color means restored. The player must *see* their typing repaint the world.
2. **The text is the hero.** The words to type are the most readable thing on screen at all times: large, high contrast, never behind effects. Everything else supports them.
3. **Impact without punishment.** Every correct key lands with weight; errors are brief and soft. Spectacle grows with the combo, never with failure.

Desktop first (it needs a keyboard): designed at 1366×768 and up. Menus must still work at 375px wide. Hebrew UI is right-to-left; English left-to-right; both first-class.

## Color tokens

Never hard-code a color, font size, radius or shadow. Add a token first. Tokens live in `src/ui/tokens.css` and are mirrored for 3D in `src/engine/palette.ts`.

| Token | Light (parchment) | Dark (night ink) | Use |
| --- | --- | --- | --- |
| `--bg` | `#F4EBD8` | `#14110D` | page |
| `--surface` | `#FBF5E6` | `#1E1A14` | cards, panels |
| `--surface-2` | `#EADFC6` | `#2A241B` | insets |
| `--ink` | `#1F1A14` | `#F1E7D2` | text |
| `--ink-soft` | `#5E5546` | `#B3A68D` | secondary text |
| `--line` | `#D2C4A4` | `#3A3226` | borders |
| `--gold` | `#B8862B` | `#E0B354` | primary action, combo, restored letters |
| `--techelet` | `#1F5FA8` | `#5FA4E8` | focus, next key, links |
| `--ok-fg` / `--ok-bg` | `#2F6B3A` / `#DCEBD6` | `#8FD09A` / `#1B2E1F` | correct |
| `--warn-fg` / `--warn-bg` | `#8A5A12` / `#F3E3BF` | `#E6BE72` / `#33270F` | caution |
| `--err-fg` / `--err-bg` | `#9B2F24` / `#F2D9D3` | `#F08F82` / `#3A1814` | wrong key |
| `--fade` | `#B9B4A8` | `#56524A` | the Forgetting: anything not yet restored |
| `--finger-pinky` | `#7A4E9A` | `#B793D6` | little fingers (keyboard guide) |
| `--finger-ring` | `#2E7D7A` | `#6CC4BE` | ring fingers |
| `--finger-middle` | `#B0652A` | `#E59A5C` | middle fingers |
| `--finger-index` | `#4F7A2E` | `#9CC870` | index fingers |
| `--finger-thumb` | `#6B6253` | `#A99C84` | thumbs (space) |

Helper tokens are only ever mixes of the ones above (`--gold-deep`, `--gold-soft`, `--gold-glow`, `--techelet-soft`, `--rule`, `--scrim`, `--on-gold`, the three shadows); spacing is `--sp-1..8`, type `--fs-12..64`, radius `--radius-1..3`.

Each scene adds a small palette of its own (sky, key light, fog, accent) in its folder; UI tokens never change per scene. Colorblind palettes swap ok/err for blue/orange. High-contrast mode raises ink to pure black/white and thickens borders.

## Typography

- **Display:** *Frank Ruhl Libre* (Hebrew and Latin), for titles, scene names, boss names. The feel of a printed sefer.
- **UI and body:** *Assistant* (Hebrew and Latin).
- **Typing text:** *Noto Sans Hebrew* / *Noto Sans* at large size with generous letter spacing; the dyslexia-friendly option switches to *OpenDyslexic* for Latin and wider spacing for Hebrew.
- Fonts are bundled with `@fontsource` (no network). Scale: 12, 14, 16, 20, 28, 40, 64. Typing text is never below 28.

## Shape, depth, motion

Radius 6 / 12 / 20. Panels look like paper: 1px `--line` border, soft warm shadow, a faint deckled top edge on large panels. Motion: 120 ms for feedback, 240 ms for panels, 600 ms+ only for cinematic moments. Easing `cubic-bezier(.2,.8,.2,1)`. Reduce-motion turns off shake, flashes, camera push-ins and parallax, and keeps fades.

## Layout

- **In play:** the 3D scene fills the screen. Text to type sits in the lower-middle third on a paper strip, or in-world (carved stone, holograms, banners) when the scene allows. Minimal HUD: combo (top center, grows with streak), accuracy and WPM (small, top corner), lives or lantern meter only where the scene has one. 3D keyboard with finger guide docks at the bottom and can be hidden.
- **Menus:** centered parchment column, big typed-or-clicked choices; every menu item can be chosen by typing its highlighted letter.
- **Hub:** diegetic. Doors, shelves and the desk are the menu.

## Core components

Button (primary gold, quiet, danger) · Panel · Tabs · Toggle · Slider · Select · Key-cap chip · Stat tile · Progress bar · Rank badge (S/A/B/C) · Dialogue box with speaker portrait and subtitles · Toast · Modal · Key heatmap · Line chart · Track picker card. A `/styleguide` page (dev only, `pnpm dev` then `#/styleguide`) shows every token and component in light, dark, RTL and LTR. In play (T09): the paper strip (letter states: waiting, next in `--techelet` with an underline, right in gold, fixed in `--warn-fg`, wrong in `--err-fg` on `--err-bg` with a wavy line), the combo meter (ink, techelet, silver, gold, light), the WPM and accuracy pills, gentle tips, and the keyboard guide (tilted, keys coded by the `--finger-*` colors, next key raised in techelet, optional hands); world text comes carved, on a banner or as a hologram. All of these are built in `src/ui/components` (T07); the key heatmap is `keyboardMap` with `heat`, and the track picker card is `choiceCard`. Large panels use `panel({ deckled: true })`. The page background is a scored parchment sheet (faint ruled lines); un-restored things in menus use `--fade` and a dashed outline.

## 3D art direction

Low-poly, flat-shaded forms with soft gradients, strong silhouettes, one hero light per scene, colored fog for depth, bloom on anything made of gold ink. Letters are physical things in the world: carved, floating, falling, worn as shields. Un-restored things use `--fade` and no saturation; restoring sweeps color outward from the typed word. Characters are simple stylized male figures only, never female (robes, caps, scarves; modest), animated by code: idle, walk, run, write (cast), hit, stagger, fall, cheer. On the night-ink theme the un-restored grey is lifted to a moonlit level so a forgotten world is dim but always readable. Every surface is made by the engine's `MaterialKit`, which applies the grey, the sweep and the fog (ARCHITECTURE section 7b).

## Sound direction

Typing: soft wooden/quill clicks with slight per-key variation, pitch climbing a pentatonic scale with the combo; error is a low muted knock. Music: modal melodies (freygish / minor) on plucked and bowed synth voices, built in stems (drone, pulse, melody, counter-melody, percussion) that layer in with the combo. Each region has its own theme and tempo.

In the build (T10): stems come in by combo tier (ink: drone and soft harp; techelet: melody; silver: drums; gold: second voice; light: busier drums and fills), always on the next bar line. Clicks climb the playing theme's own pentatonic ladder (two octaves up, then back down) so a streak is a melody in key; a new tier rings a short kanun-and-bell chime. Menus play the title theme softly with tiny wooden ticks for moves and clicks, rising two notes to open and falling two to go back. Mixer levels: music, effects, voice and menu sounds, each a slider in Settings > Sound. The sound room (`.sound` in screens.css: theme cards like choice cards, stem lamps as gold-lit pills, a dashed techelet typing pad, effect chips) lets the player hear everything.

## Accessibility

Status is always color + icon + word. Visible focus ring in `--techelet`. Keyboard-only everywhere. Screen-reader labels on menus. Captions for every voice line. Options: reduce motion, shake and flash sliders, colorblind palettes, high contrast, large text, dyslexia-friendly font, text speed.
