import { describe, expect, it } from 'vitest';
import en from '../../locales/en.json';
import he from '../../locales/he.json';
import {
  AMBIENCE_IDS,
  BarClock,
  barSeconds,
  Composer,
  composePhrase,
  degreeToMidi,
  fill,
  gridOf,
  hashSeed,
  LADDER_RUNGS,
  LADDERS,
  ladderRung,
  ladderSemitones,
  midiToHz,
  MODES,
  placeBar,
  Rand,
  SFX_NAMES,
  stemLevels,
  STEMS,
  THEME_IDS,
  THEMES,
  tierIntensity,
  volumeToGain,
  type ThemeSpec,
} from '../../src/audio';

const TEN_MINUTES = 600;

/** Every bar of a theme for `seconds`, at full intensity. */
function play(theme: ThemeSpec, seconds: number, form = theme.form) {
  const c = new Composer(theme);
  const bars = Math.ceil(seconds / barSeconds(theme));
  const out = [];
  for (let n = 0; n < bars; n++) out.push(c.bar(placeBar(theme, form, n), { full: true }));
  return out;
}

describe('music theory', () => {
  it('maps scale degrees to notes, across octaves', () => {
    // D freygish: D Eb F# G A Bb C.
    expect(degreeToMidi(62, 'freygish', 0)).toBe(62);
    expect(degreeToMidi(62, 'freygish', 2)).toBe(66);
    expect(degreeToMidi(62, 'freygish', 7)).toBe(74);
    expect(degreeToMidi(62, 'freygish', -1)).toBe(60);
    expect(degreeToMidi(62, 'freygish', -7)).toBe(50);
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(81)).toBeCloseTo(880);
  });

  it('key clicks climb a pentatonic ladder and turn at the top', () => {
    const rungs = Array.from({ length: 30 }, (_, i) => ladderRung(i));
    expect(rungs.slice(0, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(rungs.slice(10, 19)).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0]);
    expect(Math.max(...rungs)).toBe(LADDER_RUNGS - 1);
    expect(ladderRung(-5)).toBe(0);
    for (const mode of Object.keys(MODES) as (keyof typeof MODES)[]) {
      let prev = -1;
      for (let c = 0; c < LADDER_RUNGS; c++) {
        const s = ladderSemitones(mode, c);
        expect(s).toBeGreaterThan(prev); // always rising on the way up
        expect(LADDERS[mode]).toContain(s % 12);
        expect(MODES[mode]).toContain(s % 12); // in tune with the music
        prev = s;
      }
      expect(prev).toBeLessThan(24);
    }
  });

  it('volume sliders map to an even-sounding gain curve', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(-1)).toBe(0);
    expect(volumeToGain(Number.NaN)).toBe(0);
    expect(volumeToGain(1)).toBe(1);
    expect(volumeToGain(2)).toBe(1);
    expect(volumeToGain(0.5)).toBeCloseTo(0.25);
  });

  it('seeded random numbers repeat', () => {
    const a = new Rand(hashSeed(1, 2, 3));
    const b = new Rand(hashSeed(1, 2, 3));
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
    expect(hashSeed(1, 2)).not.toBe(hashSeed(2, 1));
  });
});

describe('themes', () => {
  it.each(THEME_IDS)('%s is well formed', (id) => {
    const th = THEMES[id];
    const grid = gridOf(th);
    expect(th.id).toBe(id);
    for (const name of th.form) expect(th.sections[name]).toBeDefined();
    for (const form of Object.values(th.phases ?? {})) {
      for (const name of form) expect(th.sections[name]).toBeDefined();
    }
    for (const s of Object.values(th.sections)) {
      expect(s.bars % 4).toBe(0);
      if (s.drums) {
        expect(th.drums[s.drums.base]).toBeDefined();
        expect(th.drums[s.drums.full]).toBeDefined();
      }
    }
    for (const cell of [...th.cells, ...th.cadences]) {
      expect(cell.reduce((a, b) => a + Math.abs(b), 0)).toBe(grid);
    }
    expect(th.pulse).toHaveLength(grid);
    for (const p of Object.values(th.drums)) expect(p).toMatch(new RegExp(`^[DTkS.]{${grid}}$`));
  });

  it('every theme is distinct: its own mode, key or tempo, and instruments', () => {
    const sigs = THEME_IDS.map((id) => {
      const t = THEMES[id];
      return `${t.mode}/${t.root}/${t.bpm}/${t.voices.melody}/${t.kit}`;
    });
    expect(new Set(sigs).size).toBe(THEME_IDS.length);
    expect(new Set(THEME_IDS.map((id) => THEMES[id].voices.melody)).size).toBe(THEME_IDS.length);
    expect(new Set(THEME_IDS.map((id) => THEMES[id].bpm)).size).toBe(THEME_IDS.length);
  });

  it('has names in both languages for every theme, place and effect', () => {
    const keys = [
      ...THEME_IDS.map((id) => THEMES[id].nameKey),
      ...THEME_IDS.map((id) => `sound.mood.${id}`),
      ...AMBIENCE_IDS.map((id) => `sound.amb.${id}`),
      ...SFX_NAMES.map((n) => `sound.sfx.${n}`),
      ...STEMS.map((s) => `sound.stem.${s}`),
      ...Object.keys(MODES).map((m) => `sound.mode.${m}`),
    ];
    for (const k of keys) {
      expect(en).toHaveProperty([k]);
      expect(he).toHaveProperty([k]);
    }
  });
});

describe('composer', () => {
  it.each(THEME_IDS)('%s plays ten minutes in tune, in time and in range', (id) => {
    const th = THEMES[id];
    const grid = gridOf(th);
    const forms = [th.form, ...Object.values(th.phases ?? {})];
    for (const form of forms) {
      const bars = play(th, TEN_MINUTES, form);
      expect(bars.length).toBeGreaterThanOrEqual(200);
      for (const [n, bar] of bars.entries()) {
        const place = placeBar(th, form, n);
        const shift = th.sections[place.section]?.transpose ?? 0;
        const melody = bar.filter((e) => e.stem === 'melody');
        expect(melody.length).toBeGreaterThan(0);
        expect(melody.length).toBeLessThanOrEqual(grid);
        for (const e of bar) {
          expect(e.step).toBeGreaterThanOrEqual(0);
          expect(e.step + e.len).toBeLessThanOrEqual(grid);
          if (e.stem === 'perc') continue;
          const pc = (((e.midi - th.root - shift) % 12) + 12) % 12;
          expect(MODES[th.mode]).toContain(pc);
          expect(e.midi).toBeGreaterThanOrEqual(24);
          expect(e.midi).toBeLessThanOrEqual(100);
          expect(e.vel).toBeGreaterThan(0);
          expect(e.vel).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('is deterministic: the same bar twice is the same notes', () => {
    for (const id of THEME_IDS) {
      const th = THEMES[id];
      const a = new Composer(th).bar(placeBar(th, th.form, 37), { full: false });
      const b = new Composer(th).bar(placeBar(th, th.form, 37), { full: false });
      expect(a).toEqual(b);
    }
  });

  it('a theme returns recognisably, but not note for note (no dull loop)', () => {
    for (const id of THEME_IDS) {
      const th = THEMES[id];
      const name = th.form[0] as string;
      // The pitch sounding on every grid step of the phrase (graces take one step).
      const melodyOf = (visit: number) =>
        composePhrase(th, name, 0, visit).flatMap((bar) => {
          const line: number[] = Array.from({ length: gridOf(th) }, () => NaN);
          for (const n of bar) for (let i = 0; i < n.len; i++) line[n.step + i] = n.deg;
          return line;
        });
      let differs = 0;
      for (let visit = 1; visit <= 6; visit++) {
        const a = melodyOf(0);
        const b = melodyOf(visit);
        const shared = a.filter((x, i) => x === b[i]).length;
        expect(shared / a.length).toBeGreaterThan(0.6);
        if (a.join() !== b.join()) differs++;
      }
      expect(differs).toBeGreaterThan(0);
    }
  });

  it('cadence phrases end on the tonic, so sections come home', () => {
    for (const id of THEME_IDS) {
      const th = THEMES[id];
      for (const [name] of Object.entries(th.sections)) {
        const s = th.sections[name];
        const bars = composePhrase(th, name, (s?.bars ?? 4) / 4 - 1, 0);
        const last = bars[3]?.at(-1);
        expect(last).toBeDefined();
        expect((((last?.deg ?? 1) % 7) + 7) % 7).toBe(0);
      }
    }
  });

  it('places bars in the form and counts passes', () => {
    const th = THEMES.meadow;
    expect(placeBar(th, th.form, 0)).toEqual({ section: 'A', bar: 0, cycle: 0, visit: 0 });
    expect(placeBar(th, th.form, 17)).toEqual({ section: 'B', bar: 1, cycle: 0, visit: 2 });
    expect(placeBar(th, th.form, 32)).toEqual({ section: 'A', bar: 0, cycle: 1, visit: 4 });
  });

  it('the full level rolls a fill into each phrase end', () => {
    expect(fill('D..TD.T.')).toBe('D..TD.TD');
    expect(fill('D.......D...T...')).toBe('D.......D...TTTD');
  });
});

describe('layers and the bar clock', () => {
  it('stems layer in as the intensity climbs, and never drop out on the way up', () => {
    const count = (i: number) => STEMS.filter((s) => stemLevels(i)[s] > 0).length;
    expect(count(0)).toBe(2); // drone and pulse
    expect(count(0.25)).toBe(3); // + melody
    expect(count(0.5)).toBe(4); // + drums
    expect(count(0.75)).toBe(5); // + second voice
    let prev = 0;
    for (let i = 0; i <= 100; i++) {
      const c = count(i / 100);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
    expect(stemLevels(-3)).toEqual(stemLevels(0));
    expect(stemLevels(7)).toEqual(stemLevels(1));
    expect(stemLevels(0).pulse).toBeLessThan(stemLevels(1).pulse);
  });

  it('combo tiers map onto the layers one by one', () => {
    expect([0, 1, 2, 3, 4].map(tierIntensity)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(tierIntensity(9)).toBe(1);
    expect(tierIntensity(-1)).toBe(0);
  });

  it('changes wait for the next bar line', () => {
    const clock = new BarClock(THEMES.meadow);
    expect(clock.nextBar().bar).toBe(0);
    clock.requestIntensity(0.75);
    expect(clock.intensity).toBe(0); // not yet: the bar is still playing
    clock.requestIntensity(0.5); // the latest request wins
    clock.nextBar();
    expect(clock.intensity).toBe(0.5);
    clock.requestIntensity(Number.NaN);
    clock.nextBar();
    expect(clock.intensity).toBe(0);
  });

  it('boss phases switch sections on the bar, and the last phase climbs', () => {
    const boss = THEMES.boss;
    const clock = new BarClock(boss);
    for (let i = 0; i < 5; i++) expect(clock.nextBar().section).toBe('P1');
    expect(clock.requestSection('phase2')).toBe(true);
    expect(clock.nextBar()).toEqual({ section: 'P2', bar: 0, cycle: 0, visit: 0 });
    expect(clock.requestSection('nonsense')).toBe(false);
    expect(clock.nextBar().section).toBe('P2');
    clock.requestSection('phase3');
    const p = clock.nextBar();
    expect(p.section).toBe('P3');
    const notes = new Composer(boss).bar(p, { full: false });
    const p1 = new Composer(boss).bar(
      { section: 'P1', bar: 0, cycle: 0, visit: 0 },
      { full: false },
    );
    const droneOf = (ns: typeof notes) => ns.find((n) => n.stem === 'drone')?.midi ?? 0;
    expect(droneOf(notes) - droneOf(p1)).toBe(1);
  });
});
