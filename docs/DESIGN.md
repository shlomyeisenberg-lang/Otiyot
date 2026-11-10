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

Button (primary gold, quiet, danger) · Panel · Tabs · Toggle · Slider · Select · Key-cap chip · Stat tile · Progress bar · Rank badge (S/A/B/C) · Dialogue box with speaker portrait and subtitles · Toast · Modal · Key heatmap · Line chart · Track picker card. A `/styleguide` page (dev only) shows every token and component in light, dark, RTL and LTR.

## 3D art direction

Low-poly, flat-shaded forms with soft gradients, strong silhouettes, one hero light per scene, colored fog for depth, bloom on anything made of gold ink. Letters are physical things in the world: carved, floating, falling, worn as shields. Un-restored things use `--fade` and no saturation; restoring sweeps color outward from the typed word. Characters are simple stylized figures (robes, caps, scarves; modest), animated by code: idle, walk, run, write (cast), hit, stagger, fall, cheer.

## Sound direction

Typing: soft wooden/quill clicks with slight per-key variation, pitch climbing a pentatonic scale with the combo; error is a low muted knock. Music: modal melodies (freygish / minor) on plucked and bowed synth voices, built in stems (drone, pulse, melody, counter-melody, percussion) that layer in with the combo. Each region has its own theme and tempo.

## Accessibility

Status is always color + icon + word. Visible focus ring in `--techelet`. Keyboard-only everywhere. Screen-reader labels on menus. Captions for every voice line. Options: reduce motion, shake and flash sliders, colorblind palettes, high contrast, large text, dyslexia-friendly font, text speed.
