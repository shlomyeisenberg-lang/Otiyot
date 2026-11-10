// Combat kit shared by the action scenes: Blots (patches of the Fading given shape) carry word
// shields and come at the scribe in waves. The first letter typed picks the Blot to lock onto;
// every correct letter cracks its shield; the finished word breaks it and restores what it hid.
// Waves follow spawn patterns drawn from a seed, so the same seed always gives the same fight.
// Pure logic: positions are an angle and a distance (1 = where Blots appear, 0 = the scribe);
// the scene turns them into a world and listens to the events.

import type { Difficulty } from './difficulty';
import type { Level } from './levels';

/** Same small generator as the engine's Rng, kept here so the kit stays free of Three.js. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export const SPAWN_PATTERNS = ['arc', 'pincer', 'stream', 'scatter', 'pairs'] as const;
export type SpawnPattern = (typeof SPAWN_PATTERNS)[number];

/** Blots come from the front: angles in [-FRONT, FRONT] radians around the scribe's facing. */
export const FRONT = 1.15;
/** Distance at which a Blot touches the scribe. */
export const CONTACT = 0.1;
/** On Calm, Blots stop and wait about this far out. */
export const CALM_HOLD = 0.36;
/** Pause between waves, seconds. */
export const WAVE_PAUSE = 2.2;
/** Where a Blot is thrown back to after it smudged the scribe. */
export const KNOCKBACK = 0.62;

export interface Spawn {
  /** Seconds after the wave starts. */
  at: number;
  angle: number;
  /** 0 small, 1 normal, 2 large (bigger shield, slower). */
  size: 0 | 1 | 2;
}

export interface WavePlan {
  pattern: SpawnPattern;
  spawns: Spawn[];
}

/** The waves of one fight, from the seed. */
export function planWaves(level: Level, difficulty: Difficulty, seed: number): WavePlan[] {
  const r = seeded(seed);
  const waves: WavePlan[] = [];
  let last: SpawnPattern | null = null;
  for (let w = 0; w < level.waves; w++) {
    let pattern = SPAWN_PATTERNS[Math.floor(r() * SPAWN_PATTERNS.length)] as SpawnPattern;
    if (pattern === last) {
      pattern = SPAWN_PATTERNS[
        (SPAWN_PATTERNS.indexOf(pattern) + 1) % SPAWN_PATTERNS.length
      ] as SpawnPattern;
    }
    if (w === 0) pattern = 'arc';
    last = pattern;
    const count = level.enemies + w * level.growth;
    const gap = difficulty.spawnGap;
    const spawns: Spawn[] = [];
    for (let i = 0; i < count; i++) {
      const k = count > 1 ? i / (count - 1) : 0.5;
      let angle = 0;
      let at = i * gap;
      switch (pattern) {
        case 'arc':
          angle = (k * 2 - 1) * FRONT * 0.8;
          break;
        case 'pincer':
          angle = (i % 2 === 0 ? -1 : 1) * FRONT * (0.95 - 0.25 * r());
          break;
        case 'stream': {
          const lane = (r() * 2 - 1) * FRONT * 0.4;
          angle = lane + (r() * 2 - 1) * 0.12;
          at = i * gap * 0.8;
          break;
        }
        case 'scatter':
          angle = (r() * 2 - 1) * FRONT;
          at = i * gap * (0.6 + r() * 0.8);
          break;
        case 'pairs':
          angle = (i % 2 === 0 ? -1 : 1) * FRONT * (0.3 + 0.5 * r());
          at = Math.floor(i / 2) * gap * 1.6;
          break;
      }
      // The last Blot of later waves is a big one: a long word, slow and heavy.
      const big = w > 0 && i === count - 1;
      const size: 0 | 1 | 2 = big ? 2 : r() < 0.3 ? 0 : 1;
      spawns.push({ at, angle, size });
    }
    waves.push({ pattern, spawns });
  }
  return waves;
}

export interface Blot {
  readonly id: number;
  active: boolean;
  word: string;
  /** Letters of the word typed so far (cracks in the shield). */
  typed: number;
  /** Radians around the scribe (0 = straight ahead). */
  angle: number;
  /** 1 where it appeared .. 0 at the scribe. */
  dist: number;
  /** Arena radii per second. */
  speed: number;
  size: 0 | 1 | 2;
  /** Seconds since it appeared. */
  age: number;
  locked: boolean;
  /** Counts down after a knockback; it does not move meanwhile. */
  stun: number;
}

/** The words that the typing driver should show (see PlayController's targeting). */
export interface TargetWords {
  word: string;
  lookahead: string;
}

/** How a combat scene lets the first letter pick the enemy (PlayController calls it). */
export interface Targeting {
  /** The word of the Blot whose shield starts with `ch` (nearest first), or null. */
  pick(ch: string): TargetWords | null;
  /** The word to type when nothing is locked: keeps `current` if its Blot is there. */
  auto(current: string): TargetWords | null;
}

export interface CombatListener {
  spawn?(b: Blot): void;
  lock?(b: Blot): void;
  /** A correct letter hit the locked Blot's shield. */
  hit?(b: Blot): void;
  /** The shield broke (the word was finished). */
  broken?(b: Blot, perfect: boolean): void;
  /** A Blot reached the scribe (never on Calm). */
  smudge?(b: Blot): void;
  /** A wave begins (0-based). */
  wave?(index: number, total: number): void;
  /** Every wave is cleared. */
  cleared?(): void;
}

export interface WaveFightOptions {
  level: Level;
  difficulty: Difficulty;
  seed: number;
  /** Words for the shields: only learned letters (levelWordSource). */
  words: { next(): string };
}

/** Most Blots the pool holds. */
export const MAX_BLOTS = 8;

export class WaveFight implements Targeting {
  readonly blots: Blot[] = [];
  readonly plan: WavePlan[];
  readonly level: Level;
  readonly difficulty: Difficulty;
  listener: CombatListener = {};

  wave = -1;
  /** Seconds into the current wave (or the pause before it). */
  time = 0;
  done = false;
  broken = 0;
  perfect = 0;
  smudges = 0;
  /** Most Blots on the field at once. */
  readonly maxOnField: number;

  private next = 0;
  private pause = 0.8;
  private upcoming = '';
  private readonly words: { next(): string };
  private readonly rng: () => number;

  constructor(o: WaveFightOptions) {
    this.level = o.level;
    this.difficulty = o.difficulty;
    this.words = o.words;
    this.rng = seeded(o.seed ^ 0x5bd1e995);
    this.plan = planWaves(o.level, o.difficulty, o.seed);
    this.maxOnField = Math.min(MAX_BLOTS, o.difficulty.maxEnemies + o.level.extraOnField);
    for (let i = 0; i < MAX_BLOTS; i++) {
      this.blots.push({
        id: i,
        active: false,
        word: '',
        typed: 0,
        angle: 0,
        dist: 1,
        speed: 0,
        size: 1,
        age: 0,
        locked: false,
        stun: 0,
      });
    }
  }

  get waves(): number {
    return this.plan.length;
  }

  get onField(): number {
    let n = 0;
    for (const b of this.blots) if (b.active) n++;
    return n;
  }

  /** Blots still to come in the whole fight, including those on the field. */
  get remaining(): number {
    let n = this.onField;
    for (let w = Math.max(0, this.wave); w < this.plan.length; w++) {
      const spawns = (this.plan[w] as WavePlan).spawns.length;
      n += w === this.wave ? spawns - this.next : spawns;
    }
    return n;
  }

  get total(): number {
    let n = 0;
    for (const w of this.plan) n += w.spawns.length;
    return n;
  }

  /** One fixed step. Allocates nothing except the word of a new Blot. */
  update(dt: number): void {
    if (this.done) return;
    if (this.pause > 0) {
      this.pause -= dt;
      if (this.pause <= 0) this.startWave();
      return;
    }
    this.time += dt;
    const wave = this.plan[this.wave] as WavePlan;
    // Spawn on schedule, but never more than the field holds.
    while (this.next < wave.spawns.length) {
      const s = wave.spawns[this.next] as Spawn;
      const due = s.at <= this.time || this.onField === 0;
      if (!due || this.onField >= this.maxOnField) break;
      this.spawn(s);
      this.next += 1;
    }
    const d = this.difficulty;
    for (const b of this.blots) {
      if (!b.active) continue;
      b.age += dt;
      if (b.stun > 0) {
        b.stun -= dt;
        continue;
      }
      if (!d.timers) {
        // Calm: come close and wait. Nothing ever reaches the scribe.
        const hold = CALM_HOLD + (b.id % 3) * 0.06;
        if (b.dist > hold) b.dist = Math.max(hold, b.dist - b.speed * dt);
        continue;
      }
      // A locked Blot slows down while its shield cracks: typing buys time.
      const slow = b.locked ? 0.55 : 1;
      b.dist -= b.speed * slow * dt;
      if (b.dist <= CONTACT) {
        this.smudges += 1;
        b.dist = KNOCKBACK;
        b.stun = 0.9;
        this.listener.smudge?.(b);
      }
    }
    if (this.next >= wave.spawns.length && this.onField === 0) {
      if (this.wave >= this.plan.length - 1) {
        this.done = true;
        this.listener.cleared?.();
      } else {
        this.pause = WAVE_PAUSE;
      }
    }
  }

  /** The Blot whose shield is `word`, if it is on the field. */
  find(word: string): Blot | null {
    for (const b of this.blots) if (b.active && b.word === word) return b;
    return null;
  }

  /** A correct letter of `word` was typed (index `i` of the word). */
  letter(word: string, i: number): void {
    let b = this.find(word);
    if (!b && word === this.upcoming) b = this.spawnEarly();
    if (!b) return;
    if (!b.locked) {
      for (const o of this.blots) o.locked = false;
      b.locked = true;
      this.listener.lock?.(b);
    }
    b.typed = Math.max(b.typed, i + 1);
    this.listener.hit?.(b);
  }

  /** `word` was finished: its Blot's shield breaks. */
  wordDone(word: string, perfect: boolean): Blot | null {
    let b = this.find(word);
    if (!b && word === this.upcoming) b = this.spawnEarly();
    if (!b) return null;
    b.active = false;
    b.locked = false;
    b.typed = b.word.length;
    this.broken += 1;
    if (perfect) this.perfect += 1;
    this.listener.broken?.(b, perfect);
    return b;
  }

  pick(ch: string): TargetWords | null {
    let best: Blot | null = null;
    for (const b of this.blots) {
      if (!b.active || !b.word.startsWith(ch)) continue;
      if (!best || b.dist < best.dist) best = b;
    }
    return best ? { word: best.word, lookahead: this.after(best.word) } : null;
  }

  auto(current: string): TargetWords | null {
    if (this.done) return null;
    if (current && (this.find(current) || current === this.upcoming)) {
      return { word: current, lookahead: this.after(current) };
    }
    const near = this.nearest(null);
    if (near) return { word: near.word, lookahead: this.after(near.word) };
    if (
      this.wave >= this.plan.length - 1 &&
      this.next >= (this.plan[this.wave]?.spawns.length ?? 0)
    ) {
      return null;
    }
    // Nothing on the field yet: show the shield of the Blot about to appear.
    return { word: this.reserve(), lookahead: '' };
  }

  private after(word: string): string {
    return this.nearest(word)?.word ?? '';
  }

  private nearest(except: string | null): Blot | null {
    let best: Blot | null = null;
    for (const b of this.blots) {
      if (!b.active || b.word === except) continue;
      if (!best || b.dist < best.dist) best = b;
    }
    return best;
  }

  private startWave(): void {
    this.wave += 1;
    this.time = 0;
    this.next = 0;
    this.listener.wave?.(this.wave, this.plan.length);
  }

  /** The word for the next Blot, chosen now so the driver can show it before it appears. */
  private reserve(): string {
    if (!this.upcoming) this.upcoming = this.pickWord();
    return this.upcoming;
  }

  /** A word whose first letter no Blot on the field uses, so one letter picks one target. */
  private pickWord(): string {
    let fallback = '';
    for (let tries = 0; tries < 16; tries++) {
      const w = this.words.next().trim();
      if (!w || w.includes(' ')) continue;
      if (this.find(w)) continue;
      if (!fallback) fallback = w;
      const first = w[0] as string;
      let clash = false;
      for (const b of this.blots) if (b.active && b.word[0] === first) clash = true;
      if (!clash) return w;
    }
    return fallback || this.words.next().trim();
  }

  private spawn(s: Spawn): Blot | null {
    let slot: Blot | null = null;
    for (const b of this.blots) {
      if (!b.active) {
        slot = b;
        break;
      }
    }
    if (!slot) return null;
    const word = this.upcoming && !this.find(this.upcoming) ? this.upcoming : this.pickWord();
    this.upcoming = '';
    const pace = this.difficulty.enemyPace * this.level.pace;
    slot.active = true;
    slot.word = word;
    slot.typed = 0;
    slot.angle = s.angle;
    slot.dist = 1;
    slot.size = s.size;
    slot.speed = pace * (s.size === 2 ? 0.7 : s.size === 0 ? 1.2 : 1) * (0.9 + this.rng() * 0.2);
    slot.age = 0;
    slot.locked = false;
    slot.stun = 0;
    this.listener.spawn?.(slot);
    return slot;
  }

  /** The player typed the shield of a Blot that had not appeared yet: bring it in now. */
  private spawnEarly(): Blot | null {
    if (this.done) return null;
    if (this.pause > 0) {
      this.pause = 0;
      this.startWave();
    }
    let wave = this.plan[this.wave];
    if (wave && this.next >= wave.spawns.length) {
      // This wave has sent everything: the word belongs to the first Blot of the next one.
      if (this.wave >= this.plan.length - 1) return null;
      this.startWave();
      wave = this.plan[this.wave];
    }
    if (!wave) return null;
    const b = this.spawn(wave.spawns[this.next] as Spawn);
    if (b) this.next += 1;
    return b;
  }
}
