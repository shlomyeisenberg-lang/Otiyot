import { describe, expect, it } from 'vitest';
import { REGIONS, REGION_IDS } from '../../src/game';
import {
  actCard,
  CAST,
  CHAPTERS,
  chapterById,
  chapterFlag,
  chapterFor,
  SPEAKERS,
} from '../../src/story';

describe('story chapters', () => {
  it('have unique ids, real regions and both languages on every line', () => {
    const ids = new Set<string>();
    for (const c of CHAPTERS) {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(REGION_IDS).toContain(c.region);
      expect(c.id).toBe(`${c.region}.${c.kind}`);
      expect(c.scene.title.he.length).toBeGreaterThan(0);
      expect(c.scene.title.en.length).toBeGreaterThan(0);
      expect(c.scene.beats.length).toBeGreaterThanOrEqual(2);
      for (const b of c.scene.beats) {
        expect(b.say).toBeDefined();
        expect(SPEAKERS).toContain(b.say?.who);
        expect(b.say?.text.he).toMatch(/[א-ת]/);
        expect(b.say?.text.en).toMatch(/[A-Za-z]/);
      }
    }
  });

  it('cover the story regions in order: every region of acts 2 and 3 has an opening', () => {
    for (const r of REGIONS.filter((x) => x.act >= 2 && x.id !== 'ladder')) {
      expect(chapterFor(r.id, 'start') ?? chapterFor(r.id, 'restored')).not.toBeNull();
    }
    expect(chapterById('rail.start')?.scene.beats.some((b) => b.say?.who === 'naftali')).toBe(true);
    expect(chapterById('scroll.start')?.scene.beats.some((b) => b.say?.who === 'keeper')).toBe(
      true,
    );
  });

  it('keep to the content rules: men and Dyo only, nothing unseemly', () => {
    const bad =
      /\b(she|her|hers|woman|women|girl|lady|queen|kiss|sexy)\b|אישה|נשים|ילדה|מלכה|נשיקה/i;
    for (const c of CHAPTERS) {
      for (const b of c.scene.beats) {
        const t = b.say?.text;
        expect(`${t?.en} ${t?.he}`).not.toMatch(bad);
      }
    }
    expect(Object.keys(CAST)).toEqual([...SPEAKERS]);
  });

  it('flag names are stable and act cards exist for acts 2 and 3 only', () => {
    expect(chapterFlag('forge.start')).toBe('ch:forge.start');
    expect(actCard(1)).toBeNull();
    expect(actCard(2)?.en).toContain('Act Two');
    expect(actCard(3)?.en).toContain('Act Three');
  });
});
