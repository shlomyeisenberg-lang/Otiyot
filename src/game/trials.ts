// The Silent Arena's trials (T26): three bosses, each with its own rank. The Arena region is
// restored once all three are beaten, and its rank is the lowest of the three (so the region's
// seal says how the whole arena went). Pure logic.

import type { Profile } from '../save';
import { rankFromNumber, rankNumber, type RegionId } from './regions';
import type { RunRank } from './results';

export const TRIAL_IDS = ['storm', 'glass', 'tide'] as const;
export type TrialId = (typeof TRIAL_IDS)[number];

/** The region the trials restore together. */
export const TRIALS_REGION: RegionId = 'arena';

export function isTrialId(v: string): v is TrialId {
  return (TRIAL_IDS as readonly string[]).includes(v);
}

/** Where a trial's rank is kept in `profile.story.ranks`. */
export function trialKey(id: TrialId): string {
  return `trial:${id}`;
}

export function trialRank(profile: Profile, id: TrialId): RunRank | null {
  return rankFromNumber(profile.story.ranks[trialKey(id)]);
}

/** The first trial not beaten yet (in board order), or null when all three are. */
export function nextTrial(profile: Profile): TrialId | null {
  return TRIAL_IDS.find((id) => trialRank(profile, id) === null) ?? null;
}

/**
 * Keeps the better rank for a trial and, once all three are beaten, restores the Arena with the
 * lowest of the three. Mutates the profile. Returns true when this win restored the Arena.
 */
export function recordTrialRank(profile: Profile, id: TrialId, rank: RunRank): boolean {
  const key = trialKey(id);
  const was = (profile.story.ranks[TRIALS_REGION] ?? 0) > 0;
  profile.story.ranks[key] = Math.max(profile.story.ranks[key] ?? 0, rankNumber(rank));
  const all = TRIAL_IDS.map((t) => profile.story.ranks[trialKey(t)] ?? 0);
  if (all.every((n) => n > 0)) profile.story.ranks[TRIALS_REGION] = Math.min(...all);
  return !was && (profile.story.ranks[TRIALS_REGION] ?? 0) > 0;
}
