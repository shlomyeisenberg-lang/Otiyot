// The journal (T32): which entries the player has opened. People, places and tips unlock as the
// story and the course advance; nothing is stored, it is read from the profile each time.
// Pure logic.

import { activeLevelOf, getProgress } from '../learn';
import type { Profile } from '../save';
import { JOURNAL_PEOPLE, TIPS, type JournalPerson } from '../story/journal';
import { rankFromNumber, REGION_IDS, REGIONS, needMet, type RegionId } from './regions';

/** What opens a person: the intro, or a restored region. */
export type PersonNeed = { kind: 'intro' } | { kind: 'region'; region: RegionId };

export const PERSON_NEEDS: Readonly<Record<JournalPerson, PersonNeed>> = {
  ezra: { kind: 'intro' },
  dyo: { kind: 'intro' },
  naftali: { kind: 'region', region: 'rail' },
  keeper: { kind: 'region', region: 'arena' },
};

export interface PersonEntry {
  id: JournalPerson;
  open: boolean;
  need: PersonNeed;
}

export interface PlaceEntry {
  id: RegionId;
  /** Open: the region can be visited now. Restored: it has a rank. */
  open: boolean;
  restored: boolean;
}

export interface TipState {
  id: string;
  open: boolean;
  level: number;
}

export interface Journal {
  people: PersonEntry[];
  places: PlaceEntry[];
  tips: TipState[];
}

function restored(profile: Profile, id: RegionId): boolean {
  return rankFromNumber(profile.story.ranks[id]) !== null;
}

/** A region is open when its course need is met and the story gate before it is restored. */
function regionOpen(profile: Profile, id: RegionId): boolean {
  const region = REGIONS.find((r) => r.id === id);
  if (!region) return false;
  if (region.after && !restored(profile, region.after)) return false;
  return needMet(profile, region.need);
}

export function journalOf(profile: Profile): Journal {
  const level = Math.max(1, activeLevelOf(getProgress(profile).completed));
  return {
    people: JOURNAL_PEOPLE.map((id) => {
      const need = PERSON_NEEDS[id];
      const open =
        need.kind === 'intro' ? profile.story.flags.intro === true : restored(profile, need.region);
      return { id, open, need };
    }),
    places: REGION_IDS.map((id) => ({
      id,
      restored: restored(profile, id),
      open: restored(profile, id) || regionOpen(profile, id),
    })),
    tips: TIPS.map((t) => ({ id: t.id, level: t.level, open: level >= t.level })),
  };
}

export function journalCounts(j: Journal): { open: number; total: number } {
  const all = [...j.people, ...j.places, ...j.tips];
  return { open: all.filter((e) => e.open).length, total: all.length };
}
