// The audio engine: one Web Audio graph for the whole game, with a mixer (music, effects, voice
// and menu volumes), a hall reverb, the adaptive music player, one-shot effects, ambience and
// positional sound. It implements the scenes' AudioPort.
//
// Browsers only allow sound after the player does something, so nothing is created until
// `unlock()` is called from the first key press or click. Until then every call is remembered
// (the theme to play) or quietly dropped (one-shot sounds).

import type { AudioPort } from '../engine/scene';
import { AmbienceLoop, isAmbienceId, NO_AMBIENCE, type AmbienceHandle } from './ambience';
import { BarClock, Composer, FULL_AT, stemLevels, type NoteEvent } from './composer';
import { isSfxName, playSfx, type SfxName, type Tuning } from './sfx';
import { Synth } from './synth';
import {
  barSeconds,
  gridOf,
  isThemeId,
  STEMS,
  THEMES,
  type StemId,
  type ThemeId,
  type ThemeSpec,
} from './themes';
import { midiToHz, volumeToGain } from './theory';

export interface Volumes {
  music: number;
  sfx: number;
  voice: number;
  ui: number;
}

export type Bus = keyof Volumes;

/** How loud each stem sits in the mix. */
const STEM_MIX: Readonly<Record<StemId, number>> = {
  drone: 0.7,
  pulse: 0.6,
  melody: 0.85,
  counter: 0.55,
  perc: 0.8,
};

const LOOKAHEAD = 0.18;
const TICK_MS = 30;

/** One theme being played: its own stems, clock and composer. */
class MusicPlayer {
  readonly clock: BarClock;
  readonly composer: Composer;
  readonly out: GainNode;
  readonly stems: Record<StemId, GainNode>;
  levels: Record<StemId, number>;
  nextBar: number;
  stopping = false;
  /** Bars played, for the sound room and tests. */
  bars = 0;

  constructor(
    readonly ctx: BaseAudioContext,
    readonly theme: ThemeSpec,
    dest: AudioNode,
    start: number,
    intensity: number,
  ) {
    this.clock = new BarClock(theme);
    this.clock.intensity = intensity;
    this.composer = new Composer(theme);
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.out.gain.exponentialRampToValueAtTime(theme.level, start + 0.8);
    this.out.connect(dest);
    this.levels = stemLevels(intensity);
    const stems = {} as Record<StemId, GainNode>;
    for (const id of STEMS) {
      const g = ctx.createGain();
      g.gain.value = this.levels[id] * STEM_MIX[id];
      g.connect(this.out);
      stems[id] = g;
    }
    this.stems = stems;
    this.nextBar = start;
  }

  fadeOut(seconds: number): void {
    const t = this.ctx.currentTime;
    this.stopping = true;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
    this.out.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    setTimeout(() => this.out.disconnect(), (seconds + 3) * 1000);
  }
}

export interface AudioEngineOptions {
  volumes: Volumes;
  /** Makes the context (tests pass an OfflineAudioContext). */
  createContext?: () => BaseAudioContext;
  /** Suspends sound while the page is hidden. */
  doc?: Document;
}

export class AudioEngine implements AudioPort {
  private ctx: BaseAudioContext | null = null;
  private synth: Synth | null = null;
  private master: GainNode | null = null;
  private buses: Record<Bus, GainNode> | null = null;
  private reverbIn: GainNode | null = null;
  private duck: GainNode | null = null;
  private player: MusicPlayer | null = null;
  private wantTheme: ThemeId | null = null;
  private wantIntensity = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly ambiences = new Set<AmbienceLoop>();
  private volumes: Volumes;
  private readonly createContext: () => BaseAudioContext;
  private ambienceSeed = 1;
  private lastTier = 0;
  private readonly doc: Document | undefined;
  private readonly onVisibility = (): void => {
    const ctx = this.ctx;
    if (!(ctx instanceof AudioContext)) return;
    if (this.doc?.hidden) void ctx.suspend();
    else void ctx.resume();
  };

  constructor(o: AudioEngineOptions) {
    this.volumes = { ...o.volumes };
    this.createContext =
      o.createContext ?? (() => new AudioContext({ latencyHint: 'interactive' }));
    this.doc = o.doc;
  }

  /** True once sound is allowed and the graph exists. */
  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Call from a key press or click: creates (or wakes) the audio graph and starts the music. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx instanceof AudioContext && this.ctx.state === 'suspended' && !this.doc?.hidden) {
        void this.ctx.resume();
      }
      return;
    }
    let ctx: BaseAudioContext;
    try {
      ctx = this.createContext();
    } catch {
      return; // No Web Audio here: the game stays silent.
    }
    this.build(ctx);
    if (ctx instanceof AudioContext) void ctx.resume();
    this.doc?.addEventListener('visibilitychange', this.onVisibility);
    if (this.wantTheme) this.startTheme(this.wantTheme);
    this.timer = setInterval(() => this.pump(), TICK_MS);
  }

  private build(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    const synth = new Synth(ctx);
    this.synth = synth;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(limiter);
    this.master = master;
    const reverb = ctx.createConvolver();
    reverb.buffer = synth.impulse(2.8, 3.2);
    const reverbIn = ctx.createGain();
    reverbIn.gain.value = 0.5;
    reverbIn.connect(reverb).connect(master);
    this.reverbIn = reverbIn;
    // The music passes through a ducker, which dips it a little under errors and impacts.
    const duck = ctx.createGain();
    duck.connect(master);
    this.duck = duck;
    const buses = {} as Record<Bus, GainNode>;
    for (const b of ['music', 'sfx', 'voice', 'ui'] as const) {
      const g = ctx.createGain();
      g.gain.value = volumeToGain(this.volumes[b]);
      g.connect(b === 'music' ? duck : master);
      buses[b] = g;
    }
    this.buses = buses;
    const sfxSend = ctx.createGain();
    sfxSend.gain.value = 0.25;
    buses.sfx.connect(sfxSend).connect(reverbIn);
  }

  /** Volumes 0..1 per bus (from the player's settings). */
  setVolumes(v: Partial<Volumes>): void {
    this.volumes = { ...this.volumes, ...v };
    const buses = this.buses;
    const ctx = this.ctx;
    if (!buses || !ctx) return;
    for (const b of ['music', 'sfx', 'voice', 'ui'] as const) {
      buses[b].gain.setTargetAtTime(volumeToGain(this.volumes[b]), ctx.currentTime, 0.05);
    }
  }

  /** Volume for spoken lines (speech synthesis plays outside Web Audio), 0..1. */
  get voiceVolume(): number {
    return volumeToGain(this.volumes.voice);
  }

  // ---- AudioPort -------------------------------------------------------------------------

  play(sound: string, pitch = 0, variant = ''): void {
    this.fire(sound, pitch, variant, null);
  }

  playAt(sound: string, x: number, y: number, z: number, pitch = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses) return;
    const p = this.panner(x, y, z);
    p.connect(this.buses.sfx);
    this.fire(sound, pitch, '', p);
    setTimeout(() => p.disconnect(), 4000);
  }

  music(theme: string | null): void {
    const id = theme && isThemeId(theme) ? theme : null;
    this.wantTheme = id;
    if (!this.ctx) return;
    if (id === null) {
      this.player?.fadeOut(1.2);
      this.player = null;
      return;
    }
    if (this.player && this.player.theme.id === id && !this.player.stopping) return;
    this.startTheme(id);
  }

  intensity(level: number): void {
    const l = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
    this.wantIntensity = l;
    this.player?.clock.requestIntensity(l);
  }

  section(name: string): void {
    this.player?.clock.requestSection(name);
  }

  ambience(id: string, x?: number, y?: number, z?: number): AmbienceHandle {
    const ctx = this.ctx;
    const synth = this.synth;
    if (!ctx || !synth || !this.buses || !isAmbienceId(id)) return NO_AMBIENCE;
    const positioned = x !== undefined && y !== undefined && z !== undefined;
    const p = positioned ? this.panner(x, y, z) : null;
    const loop = new AmbienceLoop(synth, id, this.buses.sfx, p, (this.ambienceSeed += 7919));
    this.ambiences.add(loop);
    const all = this.ambiences;
    return {
      move: (mx, my, mz) => loop.move(mx, my, mz),
      stop() {
        loop.stop();
        all.delete(loop);
      },
    };
  }

  clearAmbience(): void {
    for (const a of this.ambiences) a.stop();
    this.ambiences.clear();
  }

  listen(x: number, y: number, z: number, fx: number, fy: number, fz: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    if (l.positionX) {
      const t = ctx.currentTime;
      l.positionX.setValueAtTime(x, t);
      l.positionY.setValueAtTime(y, t);
      l.positionZ.setValueAtTime(z, t);
      l.forwardX.setValueAtTime(fx, t);
      l.forwardY.setValueAtTime(fy, t);
      l.forwardZ.setValueAtTime(fz, t);
    } else {
      l.setPosition(x, y, z);
      l.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  /** Follows the combo tier: sets the music intensity and rings a chime when a tier is reached. */
  combo(tier: number): void {
    const t = Math.max(0, Math.min(4, Math.floor(tier)));
    if (t > this.lastTier) this.play('tier', t);
    this.lastTier = t;
    this.intensity(t / 4);
  }

  // ---- inside ----------------------------------------------------------------------------

  private panner(x: number, y: number, z: number): PannerNode {
    const ctx = this.ctx as BaseAudioContext;
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 4;
    p.maxDistance = 120;
    p.rolloffFactor = 1.2;
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else {
      p.setPosition(x, y, z);
    }
    return p;
  }

  private tuning(): Tuning {
    const th = this.player?.theme ?? THEMES[this.wantTheme ?? 'hub'];
    return { root: th.root, mode: th.mode };
  }

  private fire(sound: string, pitch: number, variant: string, at: AudioNode | null): void {
    const ctx = this.ctx;
    const synth = this.synth;
    const buses = this.buses;
    if (!ctx || !synth || !buses || !isSfxName(sound)) return;
    const name: SfxName = sound;
    const dest = at ?? (name.startsWith('ui-') ? buses.ui : buses.sfx);
    const t = ctx.currentTime + 0.005;
    const tier = Math.round(this.wantIntensity * 4);
    playSfx(synth, name, dest, t, this.tuning(), { pitch, variant, tier });
    if (name === 'error' || name === 'impact') this.dip(name === 'error' ? 0.8 : 0.6);
  }

  /** Dips the music for a moment. */
  private dip(to: number): void {
    const ctx = this.ctx;
    const d = this.duck;
    if (!ctx || !d) return;
    const t = ctx.currentTime;
    d.gain.cancelScheduledValues(t);
    d.gain.setValueAtTime(d.gain.value, t);
    d.gain.linearRampToValueAtTime(to, t + 0.03);
    d.gain.setTargetAtTime(1, t + 0.12, 0.15);
  }

  private startTheme(id: ThemeId): void {
    const ctx = this.ctx;
    const buses = this.buses;
    const reverbIn = this.reverbIn;
    if (!ctx || !buses || !reverbIn) return;
    const old = this.player;
    old?.fadeOut(1.5);
    const theme = THEMES[id];
    const player = new MusicPlayer(
      ctx,
      theme,
      buses.music,
      ctx.currentTime + 0.1,
      this.wantIntensity,
    );
    const send = ctx.createGain();
    send.gain.value = theme.reverb;
    player.out.connect(send).connect(reverbIn);
    this.player = player;
  }

  /** The scheduler: writes the next bars a little ahead of time. */
  private pump(): void {
    const ctx = this.ctx;
    const synth = this.synth;
    if (!ctx || !synth) return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    const p = this.player;
    if (p && !p.stopping) {
      while (p.nextBar < horizon) this.scheduleBar(p, synth);
    }
    for (const a of this.ambiences) a.tick(horizon);
  }

  /** Writes one bar of music, starting at `p.nextBar`. Exposed for offline rendering. */
  scheduleBar(p: MusicPlayer, synth: Synth): void {
    const theme = p.theme;
    const start = p.nextBar;
    const place = p.clock.nextBar();
    const levels = stemLevels(p.clock.intensity);
    const beat = barSeconds(theme) / theme.beats;
    for (const id of STEMS) {
      const target = levels[id] * STEM_MIX[id];
      // Stems fade in or out over one beat from the bar line.
      p.stems[id].gain.setTargetAtTime(target, start, beat / 3);
    }
    const before = p.levels;
    p.levels = levels;
    const events = p.composer.bar(place, { full: p.clock.intensity >= FULL_AT });
    const grid = gridOf(theme);
    const stepDur = barSeconds(theme) / grid;
    const bright = theme.brightness + (p.clock.intensity >= FULL_AT ? 0.15 : 0);
    for (const ev of events) {
      // Skip stems that are silent now and were silent before (nothing to fade out).
      if (levels[ev.stem] === 0 && before[ev.stem] === 0) continue;
      this.playEvent(synth, theme, p, ev, start, stepDur, bright);
    }
    p.nextBar = start + barSeconds(theme);
    p.bars += 1;
  }

  private playEvent(
    synth: Synth,
    theme: ThemeSpec,
    p: MusicPlayer,
    ev: NoteEvent,
    barStart: number,
    stepDur: number,
    bright: number,
  ): void {
    const offbeat = theme.sub !== 3 && ev.step % 2 === 1;
    const swing = offbeat ? theme.swing * stepDur : 0;
    // A touch of human timing on the melody.
    const human = ev.stem === 'melody' ? ((ev.midi * 37 + ev.step * 11) % 7) * 0.002 : 0;
    const t = barStart + ev.step * stepDur + swing + human;
    const dest = p.stems[ev.stem];
    if (ev.stem === 'perc') {
      if (ev.hit) synth.drum(theme.kit, ev.hit, dest, t, ev.vel);
      return;
    }
    synth.note(theme.voices[ev.stem], dest, t, midiToHz(ev.midi), ev.len * stepDur, ev.vel, bright);
  }

  /** A snapshot for the sound room and the tests. */
  get status(): {
    ready: boolean;
    theme: ThemeId | null;
    bar: number;
    intensity: number;
    stems: Record<StemId, number>;
    ambiences: number;
  } {
    const p = this.player;
    return {
      ready: this.ready,
      theme: p && !p.stopping ? p.theme.id : null,
      bar: p ? p.bars : 0,
      intensity: p ? p.clock.intensity : this.wantIntensity,
      stems: p ? p.levels : stemLevels(this.wantIntensity),
      ambiences: this.ambiences.size,
    };
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.clearAmbience();
    this.doc?.removeEventListener('visibilitychange', this.onVisibility);
    this.synth?.dispose();
    const ctx = this.ctx;
    if (ctx instanceof AudioContext) void ctx.close();
    this.ctx = null;
    this.synth = null;
    this.buses = null;
    this.player = null;
  }

  /**
   * Renders a theme offline (no speakers) and returns the samples: used by the sound room's
   * check and the browser test to prove each theme makes sound without clipping.
   */
  static async render(
    theme: ThemeId,
    seconds: number,
    intensity: number,
    sampleRate = 22050,
  ): Promise<Float32Array> {
    const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
    const eng = new AudioEngine({
      volumes: { music: 1, sfx: 1, voice: 1, ui: 1 },
      createContext: () => ctx,
    });
    eng.build(ctx);
    eng.wantIntensity = intensity;
    eng.startTheme(theme);
    const p = eng.player;
    const synth = eng.synth;
    if (p && synth) while (p.nextBar < seconds) eng.scheduleBar(p, synth);
    const buf = await ctx.startRendering();
    eng.synth?.dispose();
    return buf.getChannelData(0);
  }
}
