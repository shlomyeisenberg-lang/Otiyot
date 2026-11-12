// The shape of the Jaffa Line's track, as plain data (no 3D; unit-tested). The line runs from the
// south toward the north; after every third stretch it swings into a bend, left and then right
// again, so it winds up from the coast but never wanders far from straight.

import { BEND_EVERY } from './plan';

/** World units of track per stretch (one word), and the spacing of track samples. */
export const STRETCH_LENGTH = 16;
export const SAMPLE = 1;
/** How long a bend takes to turn, and how far it turns (radians). */
export const BEND_LENGTH = 12;
export const BEND_ANGLE = 0.8;

export interface TrackPoint {
  x: number;
  z: number;
  /** Direction of travel: 0 is straight toward -z, positive turns toward +x. */
  heading: number;
}

export interface Track {
  points: readonly TrackPoint[];
  /** Length of the track in world units. */
  length: number;
}

const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** The heading at distance `s` along a line of `stretches` stretches. */
export function headingAt(s: number, stretches: number): number {
  let heading = 0;
  let sign = 1;
  for (let i = BEND_EVERY - 1; i < stretches - 1; i += BEND_EVERY) {
    const centre = (i + 1) * STRETCH_LENGTH;
    heading += sign * BEND_ANGLE * smooth((s - (centre - BEND_LENGTH / 2)) / BEND_LENGTH);
    sign = -sign;
  }
  return heading;
}

/** Samples the whole track, plus a run-in before the start and a run-out after the end. */
export function buildTrack(stretches: number): Track {
  const length = Math.max(1, stretches) * STRETCH_LENGTH;
  const points: TrackPoint[] = [];
  let x = 0;
  let z = 0;
  const lead = 24;
  const tail = 40;
  // The run-in comes straight from the south.
  for (let k = lead; k > 0; k--) points.push({ x: 0, z: k * SAMPLE, heading: 0 });
  for (let s = 0; s <= length + tail; s += SAMPLE) {
    const heading = headingAt(s, stretches);
    points.push({ x, z, heading });
    x += Math.sin(heading) * SAMPLE;
    z -= Math.cos(heading) * SAMPLE;
  }
  return { points, length };
}

/** The point at distance `s` along the track (0 is the start line); clamps beyond the ends. */
export function pointAt(track: Track, s: number, out: TrackPoint): TrackPoint {
  const lead = 24;
  const f = Math.max(-lead, Math.min(track.points.length - lead - 1, s / SAMPLE));
  const i = Math.floor(f) + lead;
  const a = track.points[i] as TrackPoint;
  const b = track.points[Math.min(track.points.length - 1, i + 1)] as TrackPoint;
  const u = f + lead - i;
  out.x = a.x + (b.x - a.x) * u;
  out.z = a.z + (b.z - a.z) * u;
  out.heading = a.heading + (b.heading - a.heading) * u;
  return out;
}
