// T34, the polish pass: every region has its own music, the tier-up flourish escalates the same
// way everywhere, and the screens that had no tune of their own now do.
import { describe, expect, it } from 'vitest';
import { THEME_IDS, THEMES, modeTheme, regionTheme } from '../../src/audio/themes';
import { tierFlourish } from '../../src/game/feedback';
import { REGION_IDS } from '../../src/game/regions';

describe('music per region', () => {
  it('every region plays a real theme', () => {
    for (const r of REGION_IDS) expect(THEME_IDS).toContain(regionTheme(r));
  });

  it('no two story regions share a theme, except the two halves of the Silent Arena', () => {
    const seen = new Map<string, string>();
    for (const r of REGION_IDS) {
      const th = regionTheme(r);
      const other = seen.get(th);
      if (other) expect([other, r].sort()).toEqual(['arena', 'blot']);
      seen.set(th, r);
    }
  });

  it('the bosses and the final have their own phase sections', () => {
    expect(regionTheme('blot')).toBe('boss');
    expect(regionTheme('arena')).toBe('boss');
    expect(regionTheme('scroll')).toBe('final');
    expect(Object.keys(THEMES.boss.phases ?? {}).length).toBeGreaterThanOrEqual(13);
    expect(Object.keys(THEMES.final.phases ?? {}).length).toBeGreaterThanOrEqual(5);
  });

  it('lessons and Practice get the study theme, runs get their setting', () => {
    expect(modeTheme('practice', 'meadow')).toBe('study');
    expect(modeTheme('timeattack', 'shuk')).toBe('shuk');
    expect(modeTheme('survival', 'hermon')).toBe('hermon');
    expect(modeTheme('daily', 'caves')).toBe('caves');
    expect(regionTheme('nowhere')).toBe('study');
  });

  it('the new themes are calm (study) and quick (arcade)', () => {
    expect(THEMES.study.bpm).toBeLessThan(THEMES.arcade.bpm);
    expect(THEMES.study.voices.melody).toBe('musicbox');
    expect(THEMES.arcade.voices.melody).toBe('accordion');
  });
});

describe('tier-up flourish', () => {
  it('grows at every tier and clamps outside 1..4', () => {
    for (let t = 2; t <= 4; t++) {
      const a = tierFlourish(t - 1);
      const b = tierFlourish(t);
      expect(b.count).toBeGreaterThan(a.count);
      expect(b.speed).toBeGreaterThan(a.speed);
      expect(b.ring).toBeGreaterThan(a.ring);
      expect(b.push).toBeGreaterThan(a.push);
      expect(b.flash).toBeGreaterThanOrEqual(a.flash);
    }
    expect(tierFlourish(0)).toEqual(tierFlourish(1));
    expect(tierFlourish(9)).toEqual(tierFlourish(4));
  });

  it('keeps the screen tint for silver and up, and gentle', () => {
    expect(tierFlourish(1).flash).toBe(0);
    expect(tierFlourish(2).flash).toBeGreaterThan(0);
    expect(tierFlourish(4).flash).toBeLessThanOrEqual(0.25);
    expect(tierFlourish(4).push).toBeLessThanOrEqual(0.5);
  });
});
