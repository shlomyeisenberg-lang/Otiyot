# Assets

Every asset, font or library added to the game is listed here with its source and licence. The game uses procedural art and audio, so this list is short.

| Asset                                          | Source                               | Licence     | Used in                        |
| ---------------------------------------------- | ------------------------------------ | ----------- | ------------------------------ |
| Frank Ruhl Libre (Hebrew + Latin, 500 and 700) | `@fontsource/frank-ruhl-libre` 5.3.0 | SIL OFL 1.1 | Titles and display text        |
| Assistant (Hebrew + Latin, 400, 600, 700)      | `@fontsource/assistant` 5.3.0        | SIL OFL 1.1 | Menus and body text            |
| Noto Sans Hebrew (Hebrew, 400 and 500)         | `@fontsource/noto-sans-hebrew` 5.3.0 | SIL OFL 1.1 | Typing text, key caps          |
| Noto Sans (Latin, 400 and 500)                 | `@fontsource/noto-sans` 5.3.0        | SIL OFL 1.1 | Typing text, key caps          |
| OpenDyslexic (Latin, 400)                      | `@fontsource/opendyslexic` 5.3.0     | SIL OFL 1.1 | Dyslexia-friendly font option  |
| three.js (3D library)                          | `three` 0.187.0                      | MIT         | The 3D engine (`src/engine`)   |
| postprocessing (screen effects library)        | `postprocessing` 6.39.6              | Zlib        | Bloom, god rays, SSAO, grading |

Icons, the scribe portrait and the deckled paper edge are drawn in code (`src/ui/icons.ts`, `src/ui/components/feedback.ts`, `src/ui/shell.ts`); no image files. The 3D world, the characters, the sky and the letter texture are built in code as well (`src/engine`, `src/scenes`); no models or textures are shipped.
