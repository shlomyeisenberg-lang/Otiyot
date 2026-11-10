# Otiyot — Game Design

Kept in sync with what is built. Each task that changes the game updates this file.

## The pitch

The letters are fading. Signs go blank, songs lose their words, people forget each other's names. You are an apprentice sofer with a quill that writes whatever you type. Every restored letter brings color, sound and life back to the Land of Letters. You learn to touch type because the world needs you to; the course and the story are the same thing.

## Story

**The Fading (הַשִּׁכְחָה, "the Forgetting")** spreads from the far end of the land, a pale quiet that drains ink from every page. Regions it touches turn to grey parchment and fall silent.

- **Act 1 — The Quill.** In the House of the Scribe, Reb Ezra hands you his spare quill the night the lamp-sign over the door goes blank. You restore the Meadow and the Cliffs and discover the quill works only for fingers that know where the keys are.
- **Act 2 — The Road.** You cross the land restoring region after region, racing Naftali, bargaining in the night market, diving to a sunken archive. You find scorched pages signed by one hand: the Keeper.
- **Act 3 — The Keeper.** The Fading is not a monster. It is the work of the **Keeper of the Great Archive**, who lost his life's writing in a fire and concluded that what is never written can never be lost. He is erasing the land to spare it grief. In the Blank Scroll you do not destroy him; you type his lost words back, line by line, faster than he can erase them. He picks up a quill again.

## Characters

| Character | Role | Voice |
| --- | --- | --- |
| **You** (name and look chosen by the player) | Apprentice sofer | Silent; choices shown as typed words |
| **Reb Ezra** | Mentor, old sofer, patient and dry-witted. Arc: learns to let the apprentice go ahead of him | Slow, warm, short proverbs |
| **Naftali** | Rival, the fastest courier in the land ("swift as a deer"). Mocks slow typing, respects speed, ends as an ally who holds the line in the final fight | Quick, teasing |
| **Dyo** (דיו, "ink") | Comic sidekick, a talking ink drop who lives in your inkwell, terrified of blotting paper | Excitable, puns on letters |
| **The Keeper** | Antagonist with a sympathetic motive (see Act 3) | Quiet, tired, never shouts |
| Merchants, forge master, station crew, librarian | Region NPCs | One strong trait each |

## Core loop

Typing is the only verb. Words on screen are always the *expected text*; the typing core judges every key.
- **Correct key** → ink stroke, impact, sound that rises in pitch with the combo.
- **Wrong key** → a brief stumble and a dull thud; the flow never stops. Only hardcore modes fail the player.
- **Combo** → builds power and visual intensity (ink trails → gold sparks → the scene's full color bloom). Combo also layers in music stems.
- **Lookahead** → the next word is always visible, dimmed.
- **Finger guide** → 3D keyboard at the bottom shows the next key and the finger; optional animated hands.

## Scenes

Each has its own mechanic, palette, weather, time of day, music theme and enemies. "Band" is the part of the active lesson track the scene draws its text from.

| # | Scene | Place and mood | Mechanic | Band |
| --- | --- | --- | --- | --- |
| 1 | **Title** | Letters of gold ink fall onto a blank parchment and form the title | Type your name to begin | — |
| 2 | **House of the Scribe** (hub) | Stone house in the Jerusalem hills; desk, shelves, Game Room, shop, trophy shelf; day/night cycle | Walk by typing door words | — |
| 3 | **Home Row Meadow** | Spring morning, anemones, grey grass regaining green | Guided tutorial: restore flowers letter by letter | Home row |
| 4 | **Cliffs of Ein Gedi** | Desert canyon, waterfalls, ibex; golden afternoon | Stepping stones: reach up (top row) and down (bottom row) | Top and bottom rows |
| 5 | **The Gematria Forge** | Glowing smithy inside a hill; evening | Type numbers (and letter values) to keep the furnace stable | Numbers |
| 6 | **The Night Shuk** | Lantern-lit market after dark, fast-talking merchants | Punctuation is currency: type prices and haggles | Symbols and punctuation |
| 7 | **The Jaffa Line** | Clockwork train from the coast up to the hills; dawn | Rail race against Naftali: typing is boost, combos take the bends | Short words, speed |
| 8 | **The Sunken Geniza** | Flooded archive, drifting pages, shafts of light | Rhythm: type with the tide; steady pace beats bursts | Words, consistency |
| 9 | **Wings over Hermon** | Flight through a thunderstorm on a great eagle | Dodge falling words by finishing them before they land; cockpit view | Words and capitals |
| 10 | **The Star Station** | Zero-gravity observatory counting the stars | Words fire thrusters and turrets | Sentences |
| 11 | **Atbash City** | Neon district of code-breakers; rain | Timed cipher puzzles (atbash, sequence memory), patrol drones | Mixed, codes |
| 12 | **The Long Midbar** | Sandstorm desert crossing toward an oasis | Survival: sentences keep the caravan moving; visibility drops | Sentences |
| 13 | **The Lantern Caves** | Dark chalk caves; tense, not horror | Stealth: typing keeps the lantern lit, shadows close in on stumbles | Accuracy focus |
| 14 | **The Silent Arena** | Ancient stone theatre under a white sky | Multi-phase boss fights | By phase |
| 15 | **The Blank Scroll** | Endless white parchment, the Keeper's archive | Final sequence combining every mechanic, then the Keeper | Everything |
| 16 | **The Ladder** (endless) | A tower of letters rising through the clouds | Free play, high scores, modifiers | Adaptive |

The Game Room in the hub opens the **Arcade**: all 16 games from the earlier plugins in one lobby.

## Combat

Each enemy (a **Blot**, a patch of the Fading given shape) carries a word shield; typing it breaks the shield and restores what the Blot was hiding. Bosses have 3–4 phases, each changing the text type (single words → sentences → punctuated passage → a sudden shift, e.g. Hebrew to English or mirrored order), with a cinematic transition: hit-stop, camera push-in, palette shift, new music section.

## Modes

Story · Practice (targeted drills, the only place a plain drill screen is allowed) · Endless (The Ladder) · Time Attack · Survival · Daily Challenge (one seed per date, local) · Arcade. Duel is in ROADMAP "Later".

## Progression and economy

XP and levels. Currencies: **glyphs** (earned by accuracy) and **ink** (earned by combos). Abilities, e.g. *Echo* (shows one more word ahead), *Steady Hand* (absorbs one error per combo), *Second Wind*. A small skill tree, cosmetics (quills, ink colors, robes), hub decorations. Ranks S/A/B/C per scene from accuracy first, speed second. Five difficulties: Calm (no timers) · Steady · Swift · Fierce · Sofer's Trial (errors fail), each trading time pressure, error cost, word complexity and enemy pace.

## Health

Optional break and posture reminders delivered by Dyo; no hard timers on Calm.

## Playtest checklist (every scene)

Is it fun? Is it readable? Is the typing teaching something? Is the difficulty spike fair? Does it feel like homework anywhere? If it does, fix it.
