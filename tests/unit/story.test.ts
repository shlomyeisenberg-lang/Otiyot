import { describe, expect, it } from 'vitest';
import { isAllowedWord } from '../../src/learn/content';
import {
  ADVANCE_GUARD,
  APPRENTICE_LOOKS,
  apprenticeLook,
  CAST,
  CutscenePlayer,
  INTRO,
  letterCosts,
  revealedCount,
  SPEAKERS,
  type Beat,
  type Cutscene,
} from '../../src/story';

const tiny: Cutscene = {
  id: 'tiny',
  title: { he: 'קטן', en: 'Tiny' },
  beats: [
    { id: 'pan', shot: 'wide', cue: 'night', seconds: 1 },
    { id: 'hello', seconds: 0.5, say: { who: 'ezra', text: { he: 'שלום.', en: 'Hi, you.' } } },
    { id: 'pop', cue: 'pop', seconds: 0.4 },
  ],
};

function play(scene: Cutscene, speed: 'slow' | 'normal' | 'fast' | 'instant' = 'normal') {
  const beats: string[] = [];
  const ends: boolean[] = [];
  const p = new CutscenePlayer(scene, {
    lang: 'en',
    speed,
    listener: { beat: (b: Beat) => beats.push(b.id), end: (s) => ends.push(s) },
  });
  return { p, beats, ends };
}

describe('text reveal', () => {
  it('costs one per letter and adds breaths after punctuation before a space or the end', () => {
    expect(letterCosts('ab')).toEqual([1, 2]);
    expect(letterCosts('a, b.')).toEqual([1, 5, 6, 7, 15]);
    // A dot inside a word ("3.5") is not a breath.
    expect(letterCosts('3.5')).toEqual([1, 2, 3]);
  });
  it('shows letters by speed; instant shows the whole line at once', () => {
    const c = letterCosts('Hello there');
    expect(revealedCount(c, 0, 'normal')).toBe(0);
    expect(revealedCount(c, 0.1, 'slow')).toBe(1);
    expect(revealedCount(c, 0.1, 'fast')).toBe(8);
    expect(revealedCount(c, 0, 'instant')).toBe(c.length);
    expect(revealedCount(c, 99, 'slow')).toBe(c.length);
    expect(revealedCount(c, -1, 'normal')).toBe(0);
  });
  it('counts Hebrew letters as letters', () => {
    expect(letterCosts('שלום')).toHaveLength(4);
  });
});

describe('cutscene player', () => {
  it('plays beats in order: silent beats move on by themselves, lines wait for the player', () => {
    const { p, beats, ends } = play(tiny);
    p.start();
    expect(beats).toEqual(['pan']);
    p.update(0.5);
    expect(p.progress).toBeCloseTo(0.5);
    expect(p.advance()).toBe('ignored'); // a camera move cannot be hurried
    p.update(0.6);
    expect(beats).toEqual(['pan', 'hello']);
    // The extra 0.1 s carried over into the line.
    expect(p.time).toBeCloseTo(0.1);
    p.update(5);
    expect(p.lineDone).toBe(true);
    expect(p.waiting).toBe(true);
    // Waiting forever is fine: the line stays.
    p.update(60);
    expect(beats).toHaveLength(2);
    expect(p.shownText).toBe('Hi, you.');
    expect(p.advance()).toBe('next');
    expect(beats).toEqual(['pan', 'hello', 'pop']);
    p.update(0.5);
    expect(p.done).toBe(true);
    expect(ends).toEqual([false]);
    expect(p.advance()).toBe('ignored');
  });
  it('a press while the line appears shows it all; a second press right away is ignored', () => {
    const { p, beats } = play(tiny, 'slow');
    p.start();
    p.update(1.01);
    expect(p.shown).toBe(0);
    p.update(0.05);
    expect(p.shown).toBe(1);
    expect(p.advance()).toBe('revealed');
    expect(p.shownText).toBe('Hi, you.');
    expect(p.advance()).toBe('ignored');
    p.update(ADVANCE_GUARD + 0.01);
    expect(p.advance()).toBe('next');
    expect(beats.at(-1)).toBe('pop');
  });
  it('can be skipped at any moment, once', () => {
    const { p, ends } = play(tiny);
    p.start();
    p.update(0.3);
    p.skip();
    p.skip();
    expect(p.done).toBe(true);
    expect(p.skipped).toBe(true);
    expect(ends).toEqual([true]);
    expect(p.beat).toBeNull();
    expect(p.text).toBe('');
  });
  it('an empty cutscene ends as soon as it starts', () => {
    const { p, ends } = play({ id: 'none', title: { he: 'א', en: 'a' }, beats: [] });
    p.start();
    expect(ends).toEqual([false]);
  });
  it('the language picks the line', () => {
    const p = new CutscenePlayer(tiny, { lang: 'he', speed: 'instant' });
    p.start();
    p.update(1);
    expect(p.shownText).toBe('שלום.');
  });
  it('the whole intro plays through to the end by pressing continue', () => {
    const { p, beats, ends } = play(INTRO, 'fast');
    p.start();
    for (let i = 0; i < 2000 && !p.done; i++) {
      p.update(0.25);
      if (p.waiting) p.advance();
    }
    expect(ends).toEqual([false]);
    expect(beats).toEqual(INTRO.beats.map((b) => b.id));
  });
});

describe('the intro script', () => {
  it('has unique beat ids, sensible lengths, and every line in Hebrew and English', () => {
    const ids = INTRO.beats.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of INTRO.beats) {
      expect(b.seconds, b.id).toBeGreaterThan(0);
      expect(b.seconds, b.id).toBeLessThan(8);
      if (!b.say) continue;
      expect(SPEAKERS).toContain(b.say.who);
      for (const lang of ['he', 'en'] as const) {
        const line = b.say.text[lang];
        expect(line.trim().length, `${b.id} ${lang}`).toBeGreaterThan(0);
        // Short lines: one breath each.
        expect(line.length, `${b.id} ${lang}`).toBeLessThan(90);
      }
      expect(/[֐-׿]/.test(b.say.text.he), b.id).toBe(true);
      expect(/[֐-׿]/.test(b.say.text.en), b.id).toBe(false);
    }
  });
  it('opens Act 1 as the design says: the sign fades, the quill is given, Dyo appears', () => {
    const cues = INTRO.beats.map((b) => b.cue).filter(Boolean);
    expect(cues.indexOf('fading')).toBeLessThan(cues.indexOf('give-quill'));
    expect(cues.indexOf('give-quill')).toBeLessThan(cues.indexOf('dyo-pops'));
    expect(cues.at(-1)).toBe('act-title');
    const who = new Set(INTRO.beats.map((b) => b.say?.who).filter(Boolean));
    expect([...who].sort()).toEqual(['dyo', 'ezra', 'narrator']);
  });
  it('keeps to the content rules: no words for women or romance in any line', () => {
    for (const b of INTRO.beats) {
      if (!b.say) continue;
      for (const lang of ['he', 'en'] as const) {
        for (const raw of b.say.text[lang].split(/\s+/)) {
          const w = raw.replace(/[^\p{L}']/gu, '');
          if (w) expect(isAllowedWord(w, lang), `${b.id}: ${w}`).toBe(true);
        }
      }
    }
  });
});

describe('the cast', () => {
  it('names every speaker in both languages; the apprentice is never voiced', () => {
    for (const s of SPEAKERS) {
      expect(CAST[s].name.he.length).toBeGreaterThan(0);
      expect(CAST[s].name.en.length).toBeGreaterThan(0);
    }
    expect(CAST.apprentice.voice).toBeNull();
    for (const s of SPEAKERS) {
      const v = CAST[s].voice;
      if (!v) continue;
      expect(v.pitch).toBeGreaterThanOrEqual(0);
      expect(v.pitch).toBeLessThanOrEqual(2);
    }
  });
  it('apprentice looks are male apprentices only; unknown avatars get the first', () => {
    expect(APPRENTICE_LOOKS.length).toBeGreaterThan(1);
    for (const l of APPRENTICE_LOOKS) expect(['cap', 'hat', 'turban']).toContain(l.headwear);
    expect(apprenticeLook('nope').id).toBe('scribe');
    expect(apprenticeLook('dusk').id).toBe('dusk');
  });
});
