# Changelog

## Unreleased

- Design system and menus: the parchment and night-ink themes, bundled Hebrew and Latin fonts, a full component set, Hebrew (right to left) and English menus, a first-run welcome that sets up a player with a name, keyboard and lesson track, players, track, keyboard and settings screens, a pause menu, and menus that can be driven by typing each item's gold letter, by arrows and Enter, or by mouse. Display options: theme, colorblind palette, high contrast, large text, dyslexia-friendly font, reduce motion.
- Adaptive engine: the game now learns each key and letter pair (accuracy, speed, typical mix-ups, per finger), picks the weakest keys for extra practice without losing the natural mix, schedules reviews 1, 3, 7, 14 or 30 days out, keeps difficulty near the 92 to 96 percent accuracy band, and can build a timed practice session.
- Word library: over 4,000 Hebrew and 4,200 English words in themed packs (everyday, home, market, numbers, travel, sea, sky, desert, holidays, nature, school), 360 sentences per language including proverbs, difficulty tiers, a key-limited weak-key-weighted word filter, and personal word lists from typed or imported plain text.
- Lesson tracks: both built-in courses (Track 1 letter by letter, Track 2 words from the start) in Hebrew and English, selectable per profile, with progress kept per track, the 70% level-opening rule, a 90% pass mark, and a text source that serves a scene band from the active track.
- Saves and profiles: versioned local save with migrations, browser and Otzaria storage, autosave with last-good-copy recovery, several profiles, JSON export/import, one-time import of old plugin progress.
- Project skeleton: boot screen, website build, Otzaria plugin packer, CI.
