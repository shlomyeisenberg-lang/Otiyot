// The cast (GAME_DESIGN "Characters"). Names, how each one speaks, and how each one looks in a
// portrait and on the optional speech-synthesis voice. Every human is a man (ARCHITECTURE 8).

import type { Localized, Speaker } from './types';

export type PortraitKind = 'scroll' | 'elder' | 'drop' | 'courier' | 'keeper' | 'apprentice';

export interface CastMember {
  name: Localized;
  portrait: PortraitKind;
  /**
   * Speech-synthesis voice (optional, off by default). Pitch 0..2 and rate 0.1..10 as the
   * browser's SpeechSynthesis wants them. `null`: this speaker is never voiced (the apprentice is
   * silent; the narrator is read only when voices are on).
   */
  voice: { pitch: number; rate: number } | null;
}

export const CAST: Readonly<Record<Speaker, CastMember>> = {
  narrator: {
    name: { he: 'המספר', en: 'Narrator' },
    portrait: 'scroll',
    voice: { pitch: 0.9, rate: 0.92 },
  },
  ezra: {
    name: { he: 'רב עזרא', en: 'Reb Ezra' },
    portrait: 'elder',
    // Slow and warm.
    voice: { pitch: 0.7, rate: 0.82 },
  },
  dyo: {
    name: { he: 'דיו', en: 'Dyo' },
    portrait: 'drop',
    // Quick and squeaky: he is a drop of ink.
    voice: { pitch: 1.9, rate: 1.3 },
  },
  naftali: {
    name: { he: 'נפתלי', en: 'Naftali' },
    portrait: 'courier',
    voice: { pitch: 1.15, rate: 1.25 },
  },
  keeper: {
    name: { he: 'השומר', en: 'The Keeper' },
    portrait: 'keeper',
    // Quiet and tired; never shouts.
    voice: { pitch: 0.55, rate: 0.78 },
  },
  apprentice: {
    name: { he: 'החניך', en: 'The apprentice' },
    portrait: 'apprentice',
    voice: null,
  },
};

/**
 * What the player's apprentice can look like. All are young men in modest robes (ARCHITECTURE
 * section 8); the profile's `avatar` picks one. Colors are the robe, its hem and the trim (scarf,
 * cuffs and cap).
 */
export interface ApprenticeLook {
  id: string;
  robe: number;
  hem: number;
  trim: number;
  headwear: 'cap' | 'hat' | 'turban';
}

export const APPRENTICE_LOOKS: readonly ApprenticeLook[] = [
  { id: 'scribe', robe: 0x3a78c8, hem: 0x1f4a86, trim: 0xe6c36a, headwear: 'cap' },
  { id: 'olive', robe: 0x6f8a3a, hem: 0x3c4c1e, trim: 0xf0e2c0, headwear: 'cap' },
  { id: 'clay', robe: 0xb05c44, hem: 0x5a2c22, trim: 0xf0e2c0, headwear: 'turban' },
  { id: 'dusk', robe: 0x5a4f86, hem: 0x2e2850, trim: 0xe0b354, headwear: 'hat' },
];

/** The look for a profile's avatar id (the first look when the id is unknown). */
export function apprenticeLook(avatar: string): ApprenticeLook {
  return APPRENTICE_LOOKS.find((l) => l.id === avatar) ?? (APPRENTICE_LOOKS[0] as ApprenticeLook);
}
