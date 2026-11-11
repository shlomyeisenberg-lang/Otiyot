# Otiyot — Game Design

Kept in sync with what is built. Each task that changes the game updates this file.

## The pitch

The letters are fading. Signs go blank, songs lose their words, people forget each other's names. You are an apprentice sofer with a quill that writes whatever you type. Every restored letter brings color, sound and life back to the Land of Letters. You learn to touch type because the world needs you to; the course and the story are the same thing.

## Story

**The Fading (הַשִּׁכְחָה, "the Forgetting")** spreads from the far end of the land, a pale quiet that drains ink from every page. Regions it touches turn to grey parchment and fall silent.

- **Act 1 — The Quill.** In the House of the Scribe, Reb Ezra hands you his spare quill the night the lamp-sign over the door goes blank. You restore the Meadow and the Cliffs and discover the quill works only for fingers that know where the keys are.
- **Act 2 — The Road.** You cross the land restoring region after region, racing Naftali, bargaining in the night market, diving to a sunken archive. You find scorched pages signed by one hand: the Keeper.
- **Act 3 — The Keeper.** The Fading is not a monster. It is the work of the **Keeper of the Great Archive**, who lost his life's writing in a fire and concluded that what is never written can never be lost. He is erasing the land to spare it grief. In the Blank Scroll you do not destroy him; you type his lost words back, line by line, faster than he can erase them. He picks up a quill again.

**The opening (built in T12).** Night in a quiet street. The narrator: every sign in the Land of Letters knows its own name; over the door of the House of the Scribe the lamp-sign "בית הסופר" has burned for forty years. A pale mist drifts in, the street drains to grey, and the sign's letters stutter and go out one by one: tonight, it forgot. Reb Ezra steps out ("Forty years, and that sign never once stammered"), names the Forgetting (one letter, then a word, then a whole street), and gives the apprentice his spare quill, which "writes only what your fingers truly know". The inkwell on the bench rattles and Dyo climbs out, asking about blotting paper. Ezra: "He also talks. A lot." The apprentice raises the quill and writes the sign's first letter back; color returns around the house, Dyo cheers ("only a few hundred thousand to go"), and Ezra: "A slow letter written well beats a fast one smudged. Come. We begin." Card: *Act One · The Quill*. Then the House of the Scribe.

**The House of the Scribe (built in T13).** The hub is the menu. A stone house in the Jerusalem hills, cut away so the room shows: Reb Ezra writes at his desk, the shelves hold the ink shop and the trophy seals, a lectern holds the journal, a cedar door leads to the Game Room (a SOON sign hangs on it until the arcade arrives). The courtyard has an olive tree, a well, pots of anemones, the practice slate chalked with the letters you know and the scribe's tool chest; over the low wall the land falls away in terraces to a valley and far ridges where every region keeps a beacon on a winding road. Every station carries a short door word made only of letters you have learned; type it and the apprentice walks there, Dyo hopping after him. The desk opens the map (what is restored, what is open, the levels and the suggested one, and for a locked region the lesson to learn first), the slate opens your next lesson, the trophy shelf shows your ranks, the chest opens the settings. The day turns while you are home; the lamps warm the room at night. When you restore a region, its beacon lights and color rolls out across the land from the house. Reb Ezra and Dyo greet you with a line for the moment; Naftali drops by once you have beaten him on the Jaffa Line.

## Characters

| Character | Role | Voice |
| --- | --- | --- |
| **You** (name and look chosen by the player) | Apprentice sofer | Silent; choices shown as typed words |
| **Reb Ezra** | Mentor, old sofer, patient and dry-witted. Arc: learns to let the apprentice go ahead of him | Slow, warm, short proverbs |
| **Naftali** | Rival, the fastest courier in the land ("swift as a deer"). Mocks slow typing, respects speed, ends as an ally who holds the line in the final fight | Quick, teasing |
| **Dyo** (דיו, "ink") | Comic sidekick, a talking ink drop who lives in your inkwell, terrified of blotting paper | Excitable, puns on letters |
| **The Keeper** | Antagonist with a sympathetic motive (see Act 3) | Quiet, tired, never shouts |
| Merchants, forge master, station crew, librarian | Region NPCs, all male (see ARCHITECTURE section 8) | One strong trait each |

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
| 1 | **Title** | Letters of gold ink fall onto a blank parchment and form the title | Any key; every choice is picked by typing its gold letter | — |
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

## Levels follow your learning

The game adapts to where the player is in their course. The active profile's lesson track and per-key skill model decide what is playable and what text appears.

- **Learned set.** At every moment the profile has a set of unlocked keys, from the active track (Track 1 or Track 2). All typing text in every scene, mode and arcade game is built only from that set. Nothing the player has not learned is ever asked of them. New keys appear only in the lesson that teaches them.
- **Levels per scene.** Every scene has several levels (at least 3: Easy, Standard, Hard) generated from the learned set: word length, speed pressure, enemy count and lookahead grow with skill, never by adding unlearned keys. A scene with a key band that is not yet learned (Forge = numbers, Shuk = symbols) stays locked on the map with a plain note such as 'learn the number row first', and a button that jumps to the lesson that teaches it.
- **Scene order follows the course.** Scenes unlock as their key band is learned in the active track, not by a fixed list, so the story never runs ahead of the typist.
- **Auto level.** The hub suggests the best level for now from recent accuracy and speed (about 90% accuracy and rising speed moves the suggestion up; low accuracy moves it down). The player can always pick any unlocked level or difficulty.
- **Switching tracks** recomputes the learned set from that track's progress; nothing is lost.
- **Practice and Daily** use the same rule: drills and the daily seed are built from the learned set, so every player gets a fair challenge.

## Combat

Each enemy (a **Blot**, a patch of the Fading given shape) carries a word shield; typing it breaks the shield and restores what the Blot was hiding.

- **Targeting.** Blots on the field always start with different letters. The first letter you type locks onto the Blot whose shield starts with it (a gold ring turns under it); with no choice made, the nearest Blot is the word shown. Every letter fires an ink bolt from the quill and cracks the shield; the finished word shatters it, the Blot bursts into ink drops and color returns to the ground where it stood.
- **Waves.** Blots come in waves from the front in patterns (arc, pincer, stream, scatter, pairs) set by a seed; later waves are bigger and end with a large, slow Blot with a long word. A Blot that reaches the scribe smudges him (the streak drops) and is thrown back; on Calm they stop close by and wait.
- **Combo.** Errors break the streak softly: it falls to the start of a lower tier, not to zero (Steady Hand absorbs errors outright). Higher tiers hit harder, with bigger effects and more music.
- **Results.** Rank S/A/B/C from accuracy first (98 / 94 / 88), speed only between S and A; XP, glyphs (accuracy) and ink (streak). Bosses have 3–4 phases, each changing the text type (single words → sentences → punctuated passage → a sudden shift, e.g. Hebrew to English or mirrored order), with a cinematic transition: hit-stop, camera push-in, palette shift, new music section.

## Modes

Story · Practice (targeted drills, the only place a plain drill screen is allowed) · Endless (The Ladder) · Time Attack · Survival · Daily Challenge (one seed per date, local) · Arcade. Duel is in ROADMAP "Later".

## Progression and economy

XP and levels. Currencies: **glyphs** (earned by accuracy) and **ink** (earned by combos). Abilities, e.g. *Echo* (shows one more word ahead), *Steady Hand* (absorbs one error per combo), *Second Wind*. A small skill tree, cosmetics (quills, ink colors, robes), hub decorations. Ranks S/A/B/C per scene from accuracy first, speed second. Five difficulties: Calm (no timers) · Steady · Swift · Fierce · Sofer's Trial (errors fail), each trading time pressure, error cost, word complexity and enemy pace.

## Health

Optional break and posture reminders delivered by Dyo; no hard timers on Calm.

## Playtest checklist (every scene)

Is it fun? Is it readable? Is the typing teaching something? Is the difficulty spike fair? Does it feel like homework anywhere? If it does, fix it.
