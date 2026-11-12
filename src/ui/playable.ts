// Which regions have a scene to play, and where each one opens. Every scene task adds its
// region here when its scene is merged (T14 the Meadow, T15 the Cliffs, T17 the Forge, T18 the Shuk, T19 the Rail, T16 the Great Blot in the arena, ...); the hub's map
// shows the rest as "still being written". Also holds the lesson the hub asked for, so the
// lesson screen knows what to open.

import type { RegionId } from '../game/regions';
import type { Route } from './app';

export const SCENE_ROUTES: Readonly<Partial<Record<RegionId, Route>>> = {
  meadow: 'meadow',
  cliffs: 'cliffs',
  forge: 'forge',
  shuk: 'shuk',
  rail: 'rail',
  blot: 'arena',
};

export function playableRegions(): ReadonlySet<RegionId> {
  return new Set(Object.keys(SCENE_ROUTES) as RegionId[]);
}

let wanted: string | null = null;

/** The lesson to open next on the lesson screen (null: the player's next unfinished one). */
export function wantLesson(id: string | null): void {
  wanted = id;
}

/** Takes the wanted lesson (once). */
export function takeWantedLesson(): string | null {
  const id = wanted;
  wanted = null;
  return id;
}
