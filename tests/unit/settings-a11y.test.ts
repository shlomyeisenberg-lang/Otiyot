import { describe, expect, it } from 'vitest';
import {
  BREAK_CHOICES,
  CURRENT_VERSION,
  MENU_KEYS,
  defaultSettings,
  migrate,
  normalizeSave,
} from '../../src/save';
import { actsAsEscape, BreakTimer, captionsOn, reminderKeys } from '../../src/ui/health';
import { MESSAGES } from '../../src/ui/i18n';

const load = (settings: unknown) =>
  normalizeSave(
    migrate({ version: 9, profiles: [{ id: 'a', name: 'A', settings }], activeProfileId: 'a' }),
    CURRENT_VERSION,
    () => 'x',
    0,
  )?.profiles[0]?.settings;

describe('Save v10 settings', () => {
  it('a v9 save gets the new options at their defaults', () => {
    const s = load({ musicVolume: 0.2, reducedMotion: true });
    expect(s).toMatchObject({
      musicVolume: 0.2,
      reducedMotion: true,
      shake: 1,
      flash: 1,
      captions: true,
      breakMinutes: 30,
      postureTips: true,
      menuKey: 'Escape',
      difficulty: 'steady',
    });
    expect(s).toEqual({ ...defaultSettings(), musicVolume: 0.2, reducedMotion: true });
  });

  it('keeps good values and repairs bad ones', () => {
    const good = load({
      shake: 0.3,
      flash: 0,
      captions: false,
      breakMinutes: 0,
      postureTips: false,
      menuKey: 'F2',
      difficulty: 'fierce',
    });
    expect(good).toMatchObject({
      shake: 0.3,
      flash: 0,
      captions: false,
      breakMinutes: 0,
      postureTips: false,
      menuKey: 'F2',
      difficulty: 'fierce',
    });
    const bad = load({
      shake: 9,
      flash: -2,
      breakMinutes: 7,
      menuKey: 'KeyA',
      difficulty: 'nope',
    });
    expect(bad).toMatchObject({
      shake: 1,
      flash: 0,
      breakMinutes: 30,
      menuKey: 'Escape',
      difficulty: 'steady',
    });
  });

  it('the pause key can never be a key that types a character', () => {
    for (const k of MENU_KEYS) expect(k === 'Escape' || /^(F\d+|Pause)$/.test(k)).toBe(true);
    expect(BREAK_CHOICES).toContain(0);
  });
});

describe('break reminders', () => {
  it('fires once after the chosen minutes of play, then starts again', () => {
    const t = new BreakTimer(15);
    let fired = 0;
    for (let i = 0; i < 15 * 60; i += 5) if (t.tick(5)) fired++;
    expect(fired).toBe(1);
    for (let i = 0; i < 15 * 60; i += 5) if (t.tick(5)) fired++;
    expect(fired).toBe(2);
  });

  it('is silent when off, and changing the interval restarts the count', () => {
    const off = new BreakTimer(0);
    for (let i = 0; i < 1000; i++) expect(off.tick(60)).toBe(false);
    const t = new BreakTimer(15);
    t.tick(14 * 60);
    t.setMinutes(20);
    expect(t.tick(60)).toBe(false);
    t.setMinutes(20);
    expect(t.tick(19 * 60)).toBe(true);
  });

  it('rotates posture tips, or leaves them out on request', () => {
    expect([0, 1, 2, 3].map((n) => reminderKeys(true, n).tip)).toEqual([
      'health.tip0',
      'health.tip1',
      'health.tip2',
      'health.tip0',
    ]);
    expect(reminderKeys(false, 0).tip).toBeNull();
  });

  it('has text in both languages', () => {
    for (const lang of ['en', 'he'] as const) {
      for (const k of ['health.break', 'health.tip0', 'health.tip1', 'health.tip2'])
        expect(MESSAGES[lang][k]).toBeTruthy();
      for (const m of BREAK_CHOICES) expect(MESSAGES[lang][`settings.break.${m}`]).toBeTruthy();
      for (const k of MENU_KEYS) expect(MESSAGES[lang][`settings.menuKey.${k}`]).toBeTruthy();
    }
  });
});

describe('menu key and captions', () => {
  it('the chosen key acts as Escape; Escape itself needs no help', () => {
    expect(actsAsEscape('F2', 'F2')).toBe(true);
    expect(actsAsEscape('F1', 'F2')).toBe(false);
    expect(actsAsEscape('Escape', 'Escape')).toBe(false);
    expect(actsAsEscape('Escape', 'F2')).toBe(false);
  });

  it('captions stay on while story lines are read aloud', () => {
    expect(captionsOn({ captions: false, storyVoices: false })).toBe(false);
    expect(captionsOn({ captions: false, storyVoices: true })).toBe(true);
    expect(captionsOn({ captions: true, storyVoices: false })).toBe(true);
  });
});
