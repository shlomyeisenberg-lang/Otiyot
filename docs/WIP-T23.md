# WIP T23 · Atbash City (Opus builder)

## Design
- A rainy neon district of code-breakers. The Fading scrambled every sign into atbash
  (the alphabet turned backward) and shut the city's vault gates; grey patrol drones sweep the street.
- Every vault gate is two legs:
  - CIPHER: its neon sign shows the code in atbash. The HUD and the banner show the plain words
    (a typing tutor never hides what to type); every right letter flips one neon letter back.
  - SEQUENCE (memory): the vault's tumbler shows a short pattern of two codes (A B A B, A B B A...);
    each finished word turns one tumbler ring. Repetition = memory practice.
- A patrol drone leaves when a leg starts and comes back after a time measured for the leg.
  Finish the leg before it returns: unseen. If it returns first: spotted, streak drops, it goes
  round again, slower. Calm: no timer, the drone hovers far off.
- Grey to color: every word lights neon; every unlocked gate restores its block; finale: the whole
  skyline lights and the drones turn to gold lanterns.
- Levels: easy 3 gates, standard 4, hard 5. Text only from learned words.

## Done so far
- (nothing yet)

## Next
- plan.ts + unit tests, palette, scene, screen, story, theme/ambience/sfx, locales, hub route, e2e.
