// Which story chapter plays next (T35). The hub asks here before it opens a region for the first
// time (the chapter before it) and when it is shown after a region was first restored (the
// chapter after it). The chapter screen takes what was asked for, once. Everything is remembered
// in the save's story flags, so each chapter plays by itself only once; the journal replays them.

import { chapterFlag, chapterFor, type Chapter, type ChapterKind } from '../story';
import { isRestored, REGION_IDS, type RegionId } from '../game/regions';
import type { Profile } from '../save';
import type { AppContext, Route } from './app';

interface Wanted {
  id: string;
  next: Route;
}

let wanted: Wanted | null = null;

export function wantChapter(id: string, next: Route): void {
  wanted = { id, next };
}

/** Takes the chapter that was asked for (once). */
export function takeWantedChapter(): Wanted | null {
  const w = wanted;
  wanted = null;
  return w;
}

export function chapterSeen(profile: Profile, id: string): boolean {
  return profile.story.flags[chapterFlag(id)] === true;
}

/** Chapters only play for a player who has seen the opening (the story has begun). */
function storyBegun(profile: Profile): boolean {
  return profile.story.flags.intro === true;
}

/** The unseen chapter of this kind for a region, or null. */
export function unseenChapter(profile: Profile, region: string, kind: ChapterKind): Chapter | null {
  if (!storyBegun(profile)) return null;
  const c = chapterFor(region, kind);
  return c && !chapterSeen(profile, c.id) ? c : null;
}

/** The first region (in story order) whose restoration chapter has not been seen yet. */
export function pendingRestoration(profile: Profile): Chapter | null {
  for (const id of REGION_IDS as readonly RegionId[]) {
    if (!isRestored(profile, id)) continue;
    const c = unseenChapter(profile, id, 'restored');
    if (c) return c;
  }
  return null;
}

/** Opens a region's scene: through its first-time chapter when it has one, straight in otherwise. */
export function enterRegion(ctx: AppContext, region: string, route: Route): void {
  const c = unseenChapter(ctx.profile, region, 'start');
  if (!c) {
    ctx.go(route);
    return;
  }
  wantChapter(c.id, route);
  ctx.go('chapter');
}
